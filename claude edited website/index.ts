/**
 * notify-registration
 * ───────────────────
 * Fires when a doctor / health professional self-registers.
 * Sends one email to the applicant: "We received your application."
 *
 * Deploy:
 *   supabase functions deploy notify-registration --no-verify-jwt
 *
 * Required secrets:
 *   RESEND_API_KEY   — from resend.com
 *   FROM_EMAIL       — verified sender in Resend (e.g. CareNest <noreply@carenest.et>)
 *   ADMIN_EMAIL      — shown as the reply-to contact address in the email body
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { fullName?: string; email?: string; role?: string };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const { fullName = 'Applicant', email, role = 'health_professional' } = body;
  if (!email) return new Response('Missing email', { status: 400 });

  const apiKey    = Deno.env.get('RESEND_API_KEY');
  const from      = Deno.env.get('FROM_EMAIL') ?? 'CareNest <noreply@carenesttelehealth.com>';
  const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'info@carenesttelehealth.com';
  const roleLabel = role === 'doctor' ? 'Doctor' : 'Health Professional';

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <div style="background:#9C2D63;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:#fff;font-size:22px">CareNest Telemedicine</h1>
      </div>
      <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:18px">Application Received</h2>
        <p>Dear ${fullName},</p>
        <p>Thank you for applying to join the CareNest provider network as a <strong>${roleLabel}</strong>.</p>
        <p>Our admin team will review your application and verify your credentials. You will receive another email once a decision has been made — this usually takes <strong>1–2 business days</strong>.</p>
        <p>If you have any questions in the meantime, contact us at <a href="mailto:${adminEmail}">${adminEmail}</a>.</p>
        <p style="margin-top:32px;color:#64748b;font-size:13px">
          CareNest Telemedicine · Shola Market, Anchor Apartment, Addis Ababa, Ethiopia
        </p>
      </div>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email, subject: 'Your CareNest application has been received', html }),
    });
    if (!res.ok) throw new Error(await res.text());
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Email failed:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
