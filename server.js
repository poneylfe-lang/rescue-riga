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

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email, name: name || undefined }],
        subject: 'Welcome to the Rescue Club',
        htmlContent:
          '<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;background:#ece7da;color:#17130e">' +
          `<h1 style="font-size:22px;margin:0 0 12px">Welcome, ${firstName}.</h1>` +
          '<p style="line-height:1.6">You’re in the Rescue Club — Miera iela 58, Rīga.</p>' +
          '<p style="line-height:1.6">We’ll write when a big or short-dated delivery lands, or with the weekly shelf, depending on what you asked for.</p>' +
          '<p style="line-height:1.6;color:#4b433a;font-size:13px">This is a concept-site test email, sent via Brevo.</p>' +
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
