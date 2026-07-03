// Gated downloads: verifies the human (Turnstile), captures the lead in
// EmailOctopus (tagged per asset; list double opt-in applies), then returns
// the file URL. The registry lives here server-side so download URLs never
// appear in page markup — the form is the only way to obtain them.

import { verifyTurnstile, clientIp } from './_turnstile.js';
import { readBody, isValidEmail } from './_body.js';

const STORAGE = 'https://djpxdnxnvuokdfxlwktx.supabase.co/storage/v1/object/public/downloads';

export const ASSETS = {
  'ebook-embracing-the-future': {
    title: 'The AI-First Mindset® — Embracing the Future Today',
    url: `${STORAGE}/ebook-ai-first-mindset-embracing-the-future.pdf`,
  },
  'ebook-ai-era': {
    title: 'The AI Era — Adapting & Thriving',
    url: `${STORAGE}/ebook-the-ai-era-adapting-thriving.pdf`,
  },
  'ebook-building-trust': {
    title: 'The AI-First Mindset® — Building Trust in the Digital Age',
    url: `${STORAGE}/ebook-building-trust-in-the-digital-age.pdf`,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const { token, name, email, asset, source_page } = readBody(req);

  const verdict = await verifyTurnstile(token, clientIp(req));
  if (!verdict.ok) {
    return res.status(400).json({ ok: false, error: 'turnstile-failed', detail: verdict.errors });
  }

  const item = ASSETS[asset];
  if (!item) return res.status(422).json({ ok: false, error: 'unknown-asset' });
  if (!name || !email) return res.status(422).json({ ok: false, error: 'missing-fields' });
  if (!isValidEmail(email)) return res.status(422).json({ ok: false, error: 'invalid-email' });

  // Capture the lead. A failure here is logged loudly but never blocks the
  // download — the human is verified and was promised a file.
  let pending = false;
  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  const listId = process.env.EMAILOCTOPUS_LIST_ID;
  if (apiKey && listId) {
    try {
      const [firstName, ...rest] = String(name).trim().split(/\s+/);
      const resp = await fetch(`https://emailoctopus.com/api/1.6/lists/${listId}/contacts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          email_address: email,
          fields: { FirstName: firstName || '', LastName: rest.join(' ') },
          tags: [asset],
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        pending = body.status === 'PENDING';
      } else if (body && body.error && body.error.code !== 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
        console.error('download: EmailOctopus capture failed', resp.status, body, { email, asset, source_page });
      }
    } catch (err) {
      console.error('download: EmailOctopus capture threw', err, { email, asset });
    }
  } else {
    console.error('CONFIG ERROR: EmailOctopus not configured; download lead NOT stored:', { email, asset });
  }

  return res.status(200).json({ ok: true, url: item.url, title: item.title, pending });
}
