// Newsletter handler: verifies Turnstile, then (eventually) adds the subscriber
// to the mailing list. Destination is deferred per the 2026-06-19 call — for now
// it verifies the human and logs the signup so the widget can be tested end-to-end.

import { verifyTurnstile, clientIp } from './_turnstile.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const { token, firstName, lastName, email } = req.body || {};

  const verdict = await verifyTurnstile(token, clientIp(req));
  if (!verdict.ok) {
    return res.status(400).json({ ok: false, error: 'turnstile-failed', detail: verdict.errors });
  }

  if (!email) {
    return res.status(422).json({ ok: false, error: 'missing-fields' });
  }

  // TODO: wire to the mailing-list provider once chosen (deferred from launch call).
  console.warn('Newsletter signup (backend deferred):', { firstName, lastName, email });

  return res.status(200).json({ ok: true });
}
