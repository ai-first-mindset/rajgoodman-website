// Mirrors a newsletter signup into the AI-First Mindset resources platform
// (Supabase), which is the system of record for the newsletter now that
// sending has moved off EmailOctopus.
//
// Deliberately best-effort and never throws: a signup must not fail because
// the mirror is down. The caller combines this result with the EmailOctopus
// result and only reports failure when BOTH sinks refused the address.
//
// No-ops when AIFM_SUBSCRIBE_KEY is unset, which keeps local runs and the
// test suite free of network calls.

const DEFAULT_URL =
  'https://rxjtyvvoubnkbpwwruwh.supabase.co/functions/v1/newsletter-subscribe';

export async function mirrorToResources({ email, firstName, lastName, source, status }) {
  const key = process.env.AIFM_SUBSCRIBE_KEY;
  if (!key) return { ok: false, skipped: true, reason: 'not-configured' };

  const url = process.env.AIFM_SUBSCRIBE_URL || DEFAULT_URL;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name: firstName || '',
        last_name: lastName || '',
        source: source || 'platform',
        // 'pending' when the list uses double opt-in and the person has not
        // confirmed yet. Without this the platform would mark them subscribed
        // while EmailOctopus is still waiting for the confirmation click.
        status: status === 'pending' ? 'pending' : 'subscribed',
        secret: key,
      }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body.ok) {
      console.error('resources mirror failed', resp.status, body && body.error);
      return { ok: false, skipped: false, reason: (body && body.error) || `http-${resp.status}` };
    }
    // created:false means we already held the address; that is still a
    // successful outcome, the person is on the list either way.
    return { ok: true, skipped: false, created: !!body.created, status: body.status };
  } catch (err) {
    console.error('resources mirror threw', err);
    return { ok: false, skipped: false, reason: 'unreachable' };
  }
}
