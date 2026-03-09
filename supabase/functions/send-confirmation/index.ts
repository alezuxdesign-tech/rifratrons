import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = "re_ZhnNrFvX_MSkktyom1k36qn9E9rejeqD9";

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
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://tiketstrons.com';

    // Prepare ticket cards
    // Use assigned_numbers (array) or fallback to assigned_number (single)
    const tickets = Array.isArray(assigned_numbers)
      ? assigned_numbers
      : (body.assigned_number ? [body.assigned_number] : []);

    const ticketCards = tickets.map((num: number) => `
            <div style="display: inline-block; background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 12px 15px; margin: 5px; min-width: 100px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
                <span style="color: #60a5fa; font-weight: 800; font-family: monospace; font-size: 20px;">#${num.toString().padStart(6, '0')}</span>
            </div>
        `).join('');

    let credentialsBlock = '';
    if (password) {
      credentialsBlock = `
            <div style="background: ${mainColor}15; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px solid ${mainColor}30;">
              <p style="margin: 0; color: ${mainColor}; font-weight: bold; margin-bottom: 8px; font-size: 14px;">PASO FINAL: TU CUENTA ESTÁ LISTA</p>
              <p style="margin: 0; font-size: 15px; color: #cbd5e1;"><strong>Usuario:</strong> ${email}</p>
              <p style="margin: 5px 0 0 0; font-size: 15px; color: #cbd5e1;"><strong>Contraseña:</strong> ${password}</p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">Te recomendamos guardar estos datos. Úsalos para entrar al portal "Mis Tickets" y ver todos tus números en tiempo real.</p>
            </div>
            `;
    } else {
      credentialsBlock = `
            <div style="background: #111827; padding: 20px; border-radius: 20px; margin: 25px 0; border: 1px solid #1f2937;">
              <p style="margin: 0; color: #94a3b8; font-weight: bold; margin-bottom: 5px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Información de Acceso</p>
              <p style="margin: 0; font-size: 14px; color: #94a3b8;">Usa tu correo (${email}) y la contraseña que recibiste anteriormente para revisar tus tickets en el portal.</p>
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
        from: "Rifatrons <no-reply@tiketstrons.com>",
        to: [email],
        subject: `🎫 ¡Confirmación de registro: ${raffle_name}!`,
        html: `
          <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #f8fafc; background-color: #030712;">
            <div style="background-color: #0a0a0c; border-radius: 28px; padding: 45px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid #1e293b;">
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="display: inline-block; padding: 10px 20px; background: ${mainColor}15; border-radius: 100px; border: 1px solid ${mainColor}30; margin-bottom: 20px;">
                        <span style="color: ${mainColor}; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">REGISTRO EXITOSO</span>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">¡Hola, ${name}! 👋</h1>
                    <p style="font-size: 17px; line-height: 1.6; color: #94a3b8; margin-top: 15px;">
                      Ya formas parte de <strong>${raffle_name}</strong>. Aquí tienes los números que te asignamos:
                    </p>
                </div>
                
                <div style="margin: 35px 0; text-align: center;">
                  ${ticketCards}
                </div>
                
                ${credentialsBlock}

                <div style="text-align: center; margin-top: 40px;">
                  <a href="${baseUrl}/mis-tickets" style="display: inline-block; background-color: ${mainColor}; color: #ffffff; padding: 18px 36px; border-radius: 16px; text-decoration: none; font-weight: 800; font-size: 16px; box-shadow: 0 12px 20px -5px ${mainColor}50;">
                    VER MIS TICKETS
                  </a>
                  <p style="font-size: 13px; color: #475569; margin-top: 25px;">
                    ¿Tienes dudas? Consulta el estado del sorteo en tiempo real en nuestro portal.
                  </p>
                </div>

                <hr style="border: 0; border-top: 1px solid #1e293b; margin: 40px 0;" />
                
                <p style="font-size: 12px; color: #334155; text-align: center; line-height: 1.6; margin: 0;">
                  Este es un mensaje automático de <strong>Rifatrons</strong>.<br>
                  La plataforma más moderna para sorteos digitales.<br>
                  &copy; 2026 Todos los derechos reservados.
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
