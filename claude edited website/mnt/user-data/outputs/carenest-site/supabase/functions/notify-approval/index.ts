/**
 * notify-approval
 * ───────────────
 * Called by the HTML site when the admin approves or rejects a professional.
 * Sends one email to the professional with the outcome.
 *
 * Deploy:
 *   supabase functions deploy notify-approval --no-verify-jwt
 *
 * Required secrets (same as notify-registration):
 *   RESEND_API_KEY   — from resend.com
 *   ADMIN_EMAIL      — shown as reply-to / contact address in the email
 *   FROM_EMAIL       — verified sender address in Resend
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_URL = 'https://api.resend.com/emails';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from   = Deno.env.get('FROM_EMAIL') ?? 'CareNest <noreply@carenesttelehealth.com>';

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { fullName?: string; email?: string; status?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { fullName = 'Applicant', email, status, role = 'health_professional' } = body;
  if (!email || !status) return new Response('Missing email or status', { status: 400 });
  if (status !== 'active' && status !== 'rejected') {
    return new Response('Status must be active or rejected', { status: 400 });
  }

  const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'info@carenesttelehealth.com';
  const roleLabel  = role === 'doctor' ? 'Doctor' : 'Health Professional';
  const approved   = status === 'active';

  const subject = approved
    ? 'Your CareNest application has been approved!'
    : 'Update on your CareNest application';

  const html = approved ? `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <div style="background:#9C2D63;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:#fff;font-size:22px">CareNest Telemedicine</h1>
      </div>
      <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px;color:#16a34a">🎉 Application Approved</h2>
        <p>Dear ${fullName},</p>
        <p>We are pleased to inform you that your application to join the CareNest provider network as a <strong>${roleLabel}</strong> has been <strong>approved</strong>.</p>
        <p>You can now log in to the CareNest platform using the email and password you registered with.</p>
        <a href="https://agent-6a7050129f2311714f0e66b3--carenesthealth.netlify.app"
           style="display:inline-block;margin:24px 0;background:#9C2D63;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">
          Log In to CareNest
        </a>
        <p>Once logged in you will have access to your professional dashboard where you can manage your appointments and patient records.</p>
        <p>Welcome to the team!</p>
        <p style="margin-top:32px;color:#64748b;font-size:13px">
          CareNest Telemedicine · Shola Market, Anchor Apartment, Addis Ababa, Ethiopia<br>
          Questions? Contact us at <a href="mailto:${adminEmail}">${adminEmail}</a>
        </p>
      </div>
    </div>` : `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <div style="background:#1B4B5C;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:#fff;font-size:22px">CareNest Telemedicine</h1>
      </div>
      <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px">Update on Your Application</h2>
        <p>Dear ${fullName},</p>
        <p>Thank you for your interest in joining the CareNest provider network as a <strong>${roleLabel}</strong>.</p>
        <p>After reviewing your application, we are unable to proceed with your registration at this time.</p>
        <p>If you believe this is a mistake or would like to discuss your application, please contact us at <a href="mailto:${adminEmail}">${adminEmail}</a> and we will be happy to help.</p>
        <p style="margin-top:32px;color:#64748b;font-size:13px">
          CareNest Telemedicine · Shola Market, Anchor Apartment, Addis Ababa, Ethiopia
        </p>
      </div>
    </div>`;

  try {
    await sendEmail(email, subject, html);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Email send failed:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
