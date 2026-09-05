'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

// minimal .env loader — no extra dependency, just enough to read RESEND_API_KEY locally.
// .env stays out of public/, so it's never served to the browser, and out of git (see .gitignore).
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
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

app.use(express.json());

// The one real, immediate email this concept site can actually trigger: a welcome note when
// someone creates a Rescue Club account. Recurring mail (weekly shelf, restock alerts, the
// quarterly impact report) would need a real subscriber database and a scheduled job — this is
// a static file server, not that — so those stay stored preferences for now, not live sends.
app.post('/api/welcome-email', async (req, res) => {
  if (!RESEND_API_KEY) return res.status(503).json({ ok: false, error: 'RESEND_API_KEY is not set on the server.' });
  const { name, email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ ok: false, error: 'Missing email address.' });
  const firstName = (name || '').trim().split(' ')[0] || 'there';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Rescue Rīga <onboarding@resend.dev>',
        to: [email],
        subject: 'Welcome to the Rescue Club',
        html:
          '<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;background:#ece7da;color:#17130e">' +
          `<h1 style="font-size:22px;margin:0 0 12px">Welcome, ${firstName}.</h1>` +
          '<p style="line-height:1.6">You’re in the Rescue Club — Miera iela 58, Rīga.</p>' +
          '<p style="line-height:1.6">We’ll write when a big or short-dated delivery lands, or with the weekly shelf, depending on what you asked for.</p>' +
          '<p style="line-height:1.6;color:#4b433a;font-size:13px">This is a concept-site test email, sent via Resend.</p>' +
          '</div>',
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data.message || 'Resend rejected the request.' });
    res.json({ ok: true, id: data.id });
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

app.listen(PORT, () => {
  console.log(`\n  Rescue — Riga  ·  http://localhost:${PORT}\n`);
  if (!RESEND_API_KEY) console.log('  (RESEND_API_KEY not set — welcome emails are disabled)\n');
});
