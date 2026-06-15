import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cal-signature-256',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function pick(obj: any, paths: string[]): string | null {
  for (const p of paths) {
    const parts = p.split('.')
    let cur = obj
    for (const k of parts) {
      if (cur && typeof cur === 'object' && k in cur) cur = cur[k]
      else { cur = null; break }
    }
    if (cur && typeof cur === 'string') return cur
    if (typeof cur === 'number') return String(cur)
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const rawBody = await req.text()

    // Verify Cal.com HMAC signature when secret is configured
    const secret = Deno.env.get('CAL_WEBHOOK_SECRET')
    if (secret) {
      const sigHeader = req.headers.get('x-cal-signature-256') || ''
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
      const expected = Array.from(new Uint8Array(sigBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      if (sigHeader.toLowerCase() !== expected.toLowerCase()) {
        console.warn('cal-webhook: invalid signature')
        return new Response(JSON.stringify({ error: 'invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      console.warn('cal-webhook: CAL_WEBHOOK_SECRET not set — signature verification skipped')
    }

    let payload: any = {}
    try { payload = JSON.parse(rawBody) } catch { payload = {} }
    // Cal.com format: { triggerEvent, payload: { ... } }
    const data = payload?.payload ?? payload
    const attendee = Array.isArray(data?.attendees) ? data.attendees[0] : data?.attendees

    const nome =
      pick(attendee, ['name']) ||
      pick(data, ['responses.name.value', 'responses.name', 'name']) ||
      null
    const email =
      pick(attendee, ['email']) ||
      pick(data, ['responses.email.value', 'responses.email', 'email']) ||
      null
    const telefone =
      pick(data, ['responses.phone.value', 'responses.phone', 'responses.telefone.value', 'responses.telefone']) ||
      pick(attendee, ['phoneNumber', 'phone']) ||
      null
    const empresa =
      pick(data, ['responses.company.value', 'responses.empresa.value', 'responses.company', 'responses.empresa']) ||
      null
    const maior_dor =
      pick(data, ['responses.notes.value', 'responses.notes', 'additionalNotes']) ||
      null
    const cal_booking_id =
      pick(data, ['uid', 'bookingId', 'id']) || null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: inserted, error } = await supabase
      .from('leads')
      .insert({
        nome, email, telefone, empresa, maior_dor,
        cal_booking_id,
        origem: 'CAL_COM',
        status: 'NOVO',
      })
      .select('id')
      .single()

    if (error) {
      console.error('cal-webhook insert error', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, lead_id: inserted?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('cal-webhook fatal', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})