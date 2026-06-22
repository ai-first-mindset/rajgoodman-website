// Contact form handler: verifies Turnstile, then forwards the lead to DealDesk.
// DealDesk endpoint is env-gated (DEALDESK_ENDPOINT) — until Raj ships it,
// the function still verifies the human and accepts the submission gracefully.

import { verifyTurnstile, clientIp } from './_turnstile.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const { token, name, email, service, message } = req.body || {};

  // 1) Human verification
  const verdict = await verifyTurnstile(token, clientIp(req));
  if (!verdict.ok) {
    return res.status(400).json({ ok: false, error: 'turnstile-failed', detail: verdict.errors });
  }

  // 2) Basic field validation
  if (!name || !email || !message) {
    return res.status(422).json({ ok: false, error: 'missing-fields' });
  }

  // 3) Forward to DealDesk (when configured)
  const endpoint = process.env.DEALDESK_ENDPOINT;
  if (endpoint) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.DEALDESK_API_KEY && { authorization: `Bearer ${process.env.DEALDESK_API_KEY}` }),
        },
        body: JSON.stringify({ source: 'website-contact', name, email, service, message }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        console.error('DealDesk forward failed', resp.status, detail);
        return res.status(502).json({ ok: false, error: 'dealdesk-error' });
      }
    } catch (err) {
      console.error('DealDesk forward threw', err);
      return res.status(502).json({ ok: false, error: 'dealdesk-unreachable' });
    }
  } else {
    // Endpoint not yet wired — log so submissions aren't lost during the gap.
    console.warn('DEALDESK_ENDPOINT unset; contact lead not forwarded:', { name, email, service });
  }

  return res.status(200).json({ ok: true });
}
