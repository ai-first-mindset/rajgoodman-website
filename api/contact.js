// Contact form handler: verifies Turnstile, then forwards the lead to DealDesk.
// DealDesk endpoint is env-gated (DEALDESK_ENDPOINT) — until Raj ships it,
// the function still verifies the human and accepts the submission gracefully.

import { verifyTurnstile, clientIp } from './_turnstile.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const { token, name, email, service, message, source_page } = req.body || {};

  // 1) Human verification
  const verdict = await verifyTurnstile(token, clientIp(req));
  if (!verdict.ok) {
    return res.status(400).json({ ok: false, error: 'turnstile-failed', detail: verdict.errors });
  }

  // 2) Basic field validation
  if (!name || !email || !message) {
    return res.status(422).json({ ok: false, error: 'missing-fields' });
  }

  // 3) Forward to DealDesk intake (server-to-server, x-api-key). Gated on BOTH
  //    endpoint and key so setting one without the other can't open a broken
  //    window — until both exist, we accept + log the lead gracefully.
  const endpoint = process.env.DEALDESK_ENDPOINT;
  const apiKey = process.env.DEALDESK_API_KEY;
  if (endpoint && apiKey) {
    // Our form has no dedicated "service" field on Raj's side — fold the
    // dropdown selection into the message so it isn't lost.
    const dealMessage = service ? `Service interest: ${service}\n\n${message || ''}`.trim() : message;
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ name, email, message: dealMessage, source_page }),
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
    // Not fully wired yet — log so submissions aren't lost during the gap.
    console.warn('DealDesk not configured (need DEALDESK_ENDPOINT + DEALDESK_API_KEY); lead not forwarded:', { name, email, service });
  }

  return res.status(200).json({ ok: true });
}
