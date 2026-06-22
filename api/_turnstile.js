// Shared Cloudflare Turnstile verification helper.
// Files prefixed with "_" are not exposed as routes by Vercel.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile token server-side.
 * @param {string} token  The cf-turnstile-response token from the widget.
 * @param {string} [ip]   The client IP (optional but recommended).
 * @returns {Promise<{ok: boolean, errors?: string[]}>}
 */
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Misconfiguration — fail closed so we never silently skip verification.
    return { ok: false, errors: ['missing-secret-key'] };
  }
  if (!token) {
    return { ok: false, errors: ['missing-input-response'] };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.append('remoteip', ip);

  let data;
  try {
    const resp = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    data = await resp.json();
  } catch (err) {
    return { ok: false, errors: ['siteverify-unreachable'] };
  }

  return data.success
    ? { ok: true }
    : { ok: false, errors: data['error-codes'] || ['verification-failed'] };
}

/** Best-effort client IP from Vercel/proxy headers. */
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return (xff ? String(xff).split(',')[0] : req.socket?.remoteAddress || '').trim();
}
