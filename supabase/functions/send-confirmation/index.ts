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
        const { name, email, assigned_number, raffle_name, password } = await req.json();

        const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://darkgray-louse-764129.hostingersite.com';

        let credentialsBlock = '';
        if (password) {
            credentialsBlock = `
            <div style="background: #eef2ff; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #6366f1;">
              <p style="margin: 0; color: #4f46e5; font-weight: bold; margin-bottom: 5px;">Se ha creado tu cuenta. Tus credenciales de acceso:</p>
              <p style="margin: 0; font-size: 14px;"><strong>Usuario (Email):</strong> ${email}</p>
              <p style="margin: 0; font-size: 14px;"><strong>Contraseña Temporal:</strong> ${password}</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #6b7280;">Te recomendamos guardar esta contraseña.</p>
            </div>
        `;
        } else {
            credentialsBlock = `
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #94a3b8;">
              <p style="margin: 0; color: #64748b; font-weight: bold; margin-bottom: 5px;">Información de Acceso:</p>
              <p style="margin: 0; font-size: 12px; color: #475569;">Usa tu usuario habitual (${email}) y la contraseña que recibiste en tu primer correo para revisar todos tus tickets.</p>
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
                subject: `¡Tu número para ${raffle_name} es el ${assigned_number}! 🎫✨`,
                html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <h1 style="color: #6366f1;">¡Hola ${name}! 👋</h1>
            <p style="font-size: 16px; line-height: 1.5;">
              Te has registrado con éxito en la rifa <strong>${raffle_name}</strong>.
            </p>
            <div style="background: #f3f4f6; padding: 30px; border-radius: 20px; text-align: center; margin: 30px 0;">
              <p style="margin: 0; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; font-size: 12px;">Tu número de la suerte</p>
              <h2 style="font-size: 48px; margin: 10px 0; color: #111;">#${assigned_number.toString().padStart(6, '0')}</h2>
            </div>
            
            ${credentialsBlock}

            <p style="font-size: 16px; line-height: 1.5;">
              Puedes consultar tus números y el estado del sorteo en cualquier momento en nuestro portal:
            </p>
            <a href="${baseUrl}/mis-tickets" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 10px;">Ir a Mis Tickets</a>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">
              Rifatrons - La plataforma de rifas más moderna. © 2026
            </p>
          </div>
        `,
            }),
        });

        const data = await res.json();

        return new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            status: res.status,
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
});
