import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  const { method } = req;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const raffle_id = url.searchParams.get('raffle_id');
    const redirectParam = url.searchParams.get('redirect');

    // Handle JSON body if it's a POST
    let bodyRaffleId = raffle_id;
    if (method === 'POST') {
      try {
        const bodyValue = await req.text();
        if (bodyValue) {
          const body = JSON.parse(bodyValue);
          bodyRaffleId = body.raffle_id || raffle_id;
        }
      } catch (e) {
        // Fallback to query param
      }
    }

    if (!bodyRaffleId) {
      return new Response(JSON.stringify({ error: 'Missing raffle_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Generate Unique Code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24);

    const { error: codeError } = await supabase
      .from('raffle_codes')
      .insert([
        {
          raffle_id: bodyRaffleId,
          code,
          expires_at: expires_at.toISOString()
        }
      ]);

    if (codeError) throw codeError;

    // 2. Build Destination URL
    // Use the FRONTEND_URL environment variable if set, otherwise fallback to the current Hostinger URL
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://darkgray-louse-764129.hostingersite.com';
    const finalUrl = `${baseUrl}/?code=${code}&raffle=${bodyRaffleId}`;

    // 3. Handle Redirect Mode
    if (redirectParam === 'true') {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': finalUrl }
      });
    }

    // 4. Handle JSON Mode
    return new Response(
      JSON.stringify({
        success: true,
        raffle_url: finalUrl,
        code: code
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
