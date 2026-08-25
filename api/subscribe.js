// Newsletter handler: verifies Turnstile, then stores the subscriber in BOTH
// sinks - the AIFM resources platform (the system of record now that sending
// has moved off EmailOctopus) and the EmailOctopus list (kept during the
// transition so nothing is lost if the new path misbehaves).
//
// A signup is reported as successful when EITHER sink accepted it. It only
// fails when BOTH refused, because the one thing we must never do is tell a
// visitor they subscribed when their address reached nobody.

import { verifyTurnstile, clientIp } from './_turnstile.js';
import { readBody, isValidEmail } from './_body.js';
import { mirrorToResources } from './_newsletter-mirror.js';

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
  if (!isValidEmail(email)) {
    return res.status(422).json({ ok: false, error: 'invalid-email' });
  }

  // 1) EmailOctopus (v1.6). Re-subscribing an existing email is treated as
  // success so the user never sees an error for already being on the list.
  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  const listId = process.env.EMAILOCTOPUS_LIST_ID;
  let eoOk = false;
  let eoPending = false;
  if (apiKey && listId) {
    try {
      // No explicit `status`: EmailOctopus then follows the LIST setting -
      // PENDING (double opt-in confirmation email sent by EO) when double
      // opt-in is enabled on the list, SUBSCRIBED otherwise. Toggling double
      // opt-in in the EO dashboard therefore needs no code change.
      const resp = await fetch(`https://emailoctopus.com/api/1.6/lists/${listId}/contacts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          email_address: email,
          fields: { FirstName: firstName || '', LastName: lastName || '' },
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        eoOk = true;
        eoPending = body.status === 'PENDING';
      } else {
        const code = body && body.error && body.error.code;
        if (code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
          eoOk = true;
        } else {
          console.error('EmailOctopus subscribe failed', resp.status, code, body);
        }
      }
    } catch (err) {
      console.error('EmailOctopus subscribe threw', err);
    }
  } else {
    console.error('CONFIG ERROR: EmailOctopus not configured (need EMAILOCTOPUS_API_KEY + EMAILOCTOPUS_LIST_ID)');
  }

  // 2) Resources platform (system of record). Runs AFTER EmailOctopus so it
  // can inherit the double opt-in verdict: this list has DOI enabled, so a
  // signup is PENDING until the person clicks the confirmation. Marking them
  // subscribed here would mean mailing somebody who never confirmed.
  //
  // If EmailOctopus did not answer we cannot know, so we fall back to
  // 'pending' rather than risk over-subscribing on a double opt-in list.
  const mirrorStatus = eoOk ? (eoPending ? 'pending' : 'subscribed') : 'pending';
  const mirror = await mirrorToResources({
    email, firstName, lastName, source: 'rajgoodman-newsletter', status: mirrorStatus,
  });

  if (mirror.ok || eoOk) {
    // Tell the form whether a confirmation step is pending so it can show
    // "check your inbox" instead of claiming the signup is complete.
    return res.status(200).json({
      ok: true, stored: true, pending: eoPending,
      sinks: { resources: mirror.ok, emailoctopus: eoOk },
    });
  }

  // Nobody took it. Fail loudly rather than let the visitor believe they
  // subscribed while the address went nowhere.
  console.error('CONFIG ERROR: newsletter signup NOT stored by any sink:', { email });
  return res.status(502).json({ ok: false, error: 'subscribe-error', stored: false });
}
