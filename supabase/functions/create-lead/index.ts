import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const Schema = z.object({
  nome: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().min(10).max(40),
  empresa: z.string().trim().min(2).max(200),
  quantidade_veiculos: z.string().trim().min(1).max(50),
  cnpj: z.string().trim().max(20).optional().nullable(),
  maior_dor: z.string().trim().max(2000).optional().nullable(),
  origem: z.enum(['CAL_COM','WHATSAPP','FORMULARIO_DIRETO','INDICACAO','OUTRO']).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    // Anti-spam: reject if same email submitted more than 3 leads in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('email', parsed.data.email)
      .gte('created_at', oneHourAgo)
    if ((recentCount ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...parsed.data, origem: parsed.data.origem ?? 'CAL_COM', status: 'NOVO' })
      .select('id')
      .single()
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true, lead_id: data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})