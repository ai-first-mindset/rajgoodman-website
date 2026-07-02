// Newsletter handler: verifies Turnstile, then adds the subscriber to the
// EmailOctopus "rajgoodman.com Newsletter" list. Gated on EMAILOCTOPUS_API_KEY
// + EMAILOCTOPUS_LIST_ID so it degrades gracefully if either is missing.

import { verifyTurnstile, clientIp } from './_turnstile.js';
import { readBody } from './_body.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const { token, firstName, lastName, email } = readBody(req);

  const verdict = await verifyTurnstile(token, clientIp(req));
  if (!verdict.ok) {
    return res.status(400).json({ ok: false, error: 'turnstile-failed', detail: verdict.errors });
  }

  if (!email) {
    return res.status(422).json({ ok: false, error: 'missing-fields' });
  }

  // Add to EmailOctopus (v1.6). Re-subscribing an existing email is treated as
  // success so the user never sees an error for already being on the list.
  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  const listId = process.env.EMAILOCTOPUS_LIST_ID;
  if (apiKey && listId) {
    try {
      const resp = await fetch(`https://emailoctopus.com/api/1.6/lists/${listId}/contacts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          email_address: email,
          fields: { FirstName: firstName || '', LastName: lastName || '' },
          status: 'SUBSCRIBED',
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const code = body && body.error && body.error.code;
        if (code !== 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
          console.error('EmailOctopus subscribe failed', resp.status, code, body);
          return res.status(502).json({ ok: false, error: 'subscribe-error' });
        }
      }
    } catch (err) {
      console.error('EmailOctopus subscribe threw', err);
      return res.status(502).json({ ok: false, error: 'subscribe-unreachable' });
    }
  } else {
    // Signup reaches nobody in this state — same loud-config treatment as
    // /api/contact so a missing env var is visible, not a silent drop.
    console.error('CONFIG ERROR: EmailOctopus not configured (need EMAILOCTOPUS_API_KEY + EMAILOCTOPUS_LIST_ID); signup NOT stored:', { email });
    return res.status(200).json({ ok: true, stored: false });
  }

  return res.status(200).json({ ok: true, stored: true });
}
