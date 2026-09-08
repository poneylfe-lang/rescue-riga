'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

// minimal .env loader — no extra dependency, just enough to read the Brevo API key and sender
// details locally. .env stays out of public/, so it's never served to the browser, and out of git
// (see .gitignore).
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  });
})();

const app = express();
const PORT = process.env.PORT || 4173;
const PUBLIC = path.join(__dirname, 'public');
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || '';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Rescue Rīga';

app.use(express.json());

// The one real, immediate email this concept site can actually trigger: a welcome note when
// someone creates a Rescue Club account. Recurring mail (weekly shelf, restock alerts, the
// quarterly impact report) would need a real subscriber database and a scheduled job — this is
// a static file server, not that — so those stay stored preferences for now, not live sends.
app.post('/api/welcome-email', async (req, res) => {
  if (!BREVO_API_KEY) return res.status(503).json({ ok: false, error: 'BREVO_API_KEY is not set on the server.' });
  if (!BREVO_SENDER_EMAIL) return res.status(503).json({ ok: false, error: 'BREVO_SENDER_EMAIL is not set on the server.' });
  const { name, email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ ok: false, error: 'Missing email address.' });
  const firstName = (name || '').trim().split(' ')[0] || 'there';
  const VEGGIES = ['🥕', '🥔', '🧅', '🥬', '🍄', '🌽', '🍌'];
  const veg = VEGGIES[[...String(email)].reduce((s, c) => s + c.charCodeAt(0), 0) % VEGGIES.length];
  const joined = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const cardNo = String(Math.abs([...String(email)].reduce((s, c) => s * 31 + c.charCodeAt(0), 7)) % 100000).padStart(5, '0');
  const SITE_URL = 'https://rescue-riga.vercel.app';

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email, name: name || undefined }],
        subject: `Welcome to the Rescue Club, ${firstName} — your card's already stamped`,
        htmlContent: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf3df;padding:32px 16px;font-family:Helvetica,Arial,sans-serif">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:2px solid #17130e;border-radius:18px;overflow:hidden">

      <tr><td style="background:#e8562f;padding:28px 32px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.01em">RESCUE</div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#fff6d8;margin-top:4px">Rīga's anti-waste supermarket</div>
      </td></tr>

      <tr><td style="padding:32px 32px 8px">
        <h1 style="margin:0 0 14px;font-size:26px;line-height:1.15;color:#17130e">Welcome, ${firstName}.</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#17130e">
          You're in the Club. Your card's already stamped — buy anything wonky-shaped, short-dated
          or oddly labelled from here on and we won't ask questions. <b>We're the ones selling it.</b>
        </p>
      </td></tr>

      <tr><td style="padding:0 32px 24px">
        <table role="presentation" width="100%" style="background:#171c3a;border-radius:14px;padding:0">
          <tr>
            <td style="padding:20px 22px">
              <table role="presentation" width="100%">
                <tr>
                  <td style="width:50px">
                    <div style="width:44px;height:44px;border-radius:50%;background:#d8fb45;text-align:center;line-height:44px;font-size:22px">${veg}</div>
                  </td>
                  <td style="padding-left:12px;color:#ffffff">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#c7cadd">Rescue Club</div>
                    <div style="font-size:16px;font-weight:800;margin-top:2px">${firstName}</div>
                  </td>
                  <td align="right" style="color:#c7cadd;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums">
                    № ${cardNo}<br>since ${joined}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 32px 8px">
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5c5648">
          Case in point: this week's Exhibit A is a carrot that grew two legs. Charge: abnormal
          curvature. Verdict: excellent soup. Yours could be next.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr><td style="background:#d8fb45;border:2px solid #17130e;border-radius:999px">
            <a href="${SITE_URL}" style="display:inline-block;padding:14px 26px;font-size:14px;font-weight:800;color:#17130e;text-decoration:none">Start shopping →</a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 32px 28px;border-top:1.5px solid #ece5d0">
        <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#5c5648">
          We'll write when a big or short-dated delivery lands, or with the weekly shelf — depending
          on what you asked for. Miera iela 58, Rīga · open till 20:00.
        </p>
        <p style="margin:0;font-size:12px;color:#8a8371">Come hungry. Leave smug. · This is a concept-site test email, sent via Brevo.</p>
      </td></tr>

    </table>
  </td></tr>
</table>`,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data.message || 'Brevo rejected the request.' });
    res.json({ ok: true, id: data.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// password-reset code/link email. There's no real user database on this server — accounts live in
// the browser's localStorage — so this only sends the mail; the code itself is generated and
// checked entirely client-side (see the reset flow in public/index.html). That means a reset link
// only works back in the same browser that requested it, which is disclosed in the email itself.
app.post('/api/reset-email', async (req, res) => {
  if (!BREVO_API_KEY) return res.status(503).json({ ok: false, error: 'BREVO_API_KEY is not set on the server.' });
  if (!BREVO_SENDER_EMAIL) return res.status(503).json({ ok: false, error: 'BREVO_SENDER_EMAIL is not set on the server.' });
  const { name, email, code, link } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ ok: false, error: 'Missing email address.' });
  if (!code || typeof code !== 'string') return res.status(400).json({ ok: false, error: 'Missing reset code.' });
  const firstName = (name || '').trim().split(' ')[0] || 'there';
  const safeLink = typeof link === 'string' ? link : '';

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email, name: name || undefined }],
        subject: 'Reset your Rescue Club password',
        htmlContent:
          '<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;background:#ece7da;color:#17130e">' +
          `<h1 style="font-size:22px;margin:0 0 12px">Hi ${firstName},</h1>` +
          '<p style="line-height:1.6">Someone (hopefully you) asked to reset the password on this Rescue Club account.</p>' +
          (safeLink
            ? `<p style="margin:22px 0"><a href="${safeLink}" style="background:#e8562f;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">Reset my password</a></p>`
            : '') +
          `<p style="line-height:1.6">Or enter this code by hand: <b style="font-size:20px;letter-spacing:0.1em">${code}</b></p>` +
          '<p style="line-height:1.6;color:#4b433a;font-size:13px">The code expires in 30 minutes, and only works back in the browser you requested it from — this concept site keeps accounts on your device, not on a real server. If you didn’t ask for this, ignore the email.</p>' +
          '</div>',
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data.message || 'Brevo rejected the request.' });
    res.json({ ok: true, id: data.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use(
  express.static(PUBLIC, {
    extensions: ['html'],
    setHeaders(res, file) {
      if (file.includes(`${path.sep}vendor${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  })
);

// single-page fallback
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

// Vercel imports this file as a serverless function (module.exports = app) instead of
// running it directly, so only bind a real port when this file is executed as a script.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Rescue — Riga  ·  http://localhost:${PORT}\n`);
    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) console.log('  (BREVO_API_KEY / BREVO_SENDER_EMAIL not set — welcome emails are disabled)\n');
  });
}

module.exports = app;
