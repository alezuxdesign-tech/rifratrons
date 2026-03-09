import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = "re_CmjUg4EM_MMTNRqWTRRzJuso3mwSuBfmD";

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const body = await req.json();
    console.log("Received body:", JSON.stringify(body));

    const { name, email, assigned_numbers, raffle_name, password, primary_color } = body;

    const mainColor = primary_color || '#3b82f6';
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://darkgray-louse-764129.hostingersite.com';

    // Prepare ticket cards
    const tickets = Array.isArray(assigned_numbers) ? assigned_numbers : [body.assigned_number].filter(Boolean);
    const ticketCards = tickets.map((num: number) => `
            <div style="display: inline-block; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 15px; margin: 5px; min-width: 100px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <span style="color: ${mainColor}; font-weight: 800; font-family: monospace; font-size: 18px;">#${num.toString().padStart(6, '0')}</span>
            </div>
        `).join('');

    let credentialsBlock = '';
    if (password) {
      credentialsBlock = `
            <div style="background: ${mainColor}08; padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid ${mainColor}20;">
              <p style="margin: 0; color: ${mainColor}; font-weight: bold; margin-bottom: 5px;">Se ha creado tu cuenta automática:</p>
              <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Usuario:</strong> ${email}</p>
              <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Contraseña:</strong> ${password}</p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">Usa estos datos para entrar al portal "Mis Tickets" y ver todos tus números siempre.</p>
            </div>
            `;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Rifatrons <no-reply@rifratrons.alezuxmembers.com>",
        to: [email],
        subject: `¡Confirmación de registro: ${raffle_name}! 🎫`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b; background-color: #f8fafc;">
            <div style="background-color: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                <h1 style="color: #0f172a; margin-top: 0; font-size: 24px;">¡Hola, ${name}! 👋</h1>
                <p style="font-size: 16px; line-height: 1.6; color: #475569;">
                  Te has registrado con éxito en <strong>${raffle_name}</strong>. Aquí tienes tus boletos asignados:
                </p>
                
                <div style="margin: 30px 0; text-align: center;">
                  ${ticketCards}
                </div>
                
                ${credentialsBlock}

                <div style="text-align: center; margin-top: 35px;">
                  <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">
                    Puedes consultar tus números y el estado del sorteo en cualquier momento:
                  </p>
                  <a href="${baseUrl}/mis-tickets" style="display: inline-block; background-color: ${mainColor}; color: #ffffff; padding: 16px 32px; border-radius: 14px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 10px 15px -3px ${mainColor}40;">
                    Ver Mis Tickets
                  </a>
                </div>

                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;" />
                
                <p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
                  Este es un correo automático de Rifatrons. Por favor no respondas a este mensaje.<br>
                  &copy; 2026 Rifatrons. Todos los derechos reservados.
                </p>
            </div>
          </div>
        `,
      }),
    });

    const resData = await res.json();
    console.log("Resend response:", JSON.stringify(resData));

    return new Response(JSON.stringify(resData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: res.status,
    });
  } catch (err: any) {
    console.error("Critical error in function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
