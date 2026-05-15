import { createClient } from 'npm:@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@2.5.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token)
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const advanceId = body?.advance_id
    if (!advanceId) {
      return new Response(JSON.stringify({ error: 'advance_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: adv, error: aErr } = await supabase.from('trip_advances').select('*').eq('id', advanceId).maybeSingle()
    if (aErr || !adv) {
      return new Response(JSON.stringify({ error: 'Advance not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: trip } = await supabase.from('trips').select('trip_code,title,destination_city,destination_state').eq('id', adv.trip_id).maybeSingle()
    const { data: driver } = await supabase.from('drivers').select('full_name,cpf').eq('id', adv.driver_id).maybeSingle()
    const { data: company } = await supabase.from('companies').select('name,document').eq('id', adv.company_id).maybeSingle()

    const doc = new jsPDF()
    doc.setFontSize(18); doc.text('RECIBO DE ADIANTAMENTO', 105, 20, { align: 'center' })
    doc.setFontSize(10); doc.text(`${company?.name ?? ''}${company?.document ? ` · CNPJ ${company.document}` : ''}`, 105, 28, { align: 'center' })

    doc.setFontSize(11)
    let y = 45
    const line = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold'); doc.text(`${label}:`, 20, y)
      doc.setFont('helvetica', 'normal'); doc.text(value, 70, y); y += 8
    }
    line('Viagem', `${trip?.trip_code ?? ''} — ${trip?.title ?? ''}`)
    if (trip?.destination_city) line('Destino', `${trip.destination_city}${trip.destination_state ? '/' + trip.destination_state : ''}`)
    line('Motorista', `${driver?.full_name ?? '—'}${driver?.cpf ? ` · CPF ${driver.cpf}` : ''}`)
    line('Data', new Date(adv.advance_date).toLocaleString('pt-BR'))
    line('Forma de pagamento', adv.payment_method_used ?? '—')
    line('Valor', `R$ ${Number(adv.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    if (adv.notes) line('Observações', adv.notes)

    y += 10
    doc.setFontSize(10)
    const decl = `Declaro que recebi nesta data a importância acima descrita, a título de adiantamento para custeio da viagem ${trip?.trip_code ?? ''}, comprometendo-me a prestar contas dos valores utilizados e devolver o saldo remanescente, conforme política da empresa.`
    const splitText = doc.splitTextToSize(decl, 170)
    doc.text(splitText, 20, y); y += splitText.length * 5 + 30

    doc.text('______________________________', 30, y)
    doc.text('______________________________', 130, y); y += 6
    doc.text(driver?.full_name ?? 'Motorista', 30, y)
    doc.text('Gestor da frota', 130, y)

    const pdfBytes = doc.output('arraybuffer')
    const path = `${adv.company_id}/advances/${adv.id}.pdf`

    const { error: upErr } = await supabase.storage.from('trip-receipts').upload(path, new Uint8Array(pdfBytes), {
      contentType: 'application/pdf', upsert: true,
    })
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await supabase.from('trip_advances').update({ receipt_url: path }).eq('id', adv.id)

    const { data: signed } = await supabase.storage.from('trip-receipts').createSignedUrl(path, 3600)

    return new Response(JSON.stringify({ url: signed?.signedUrl, path }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})