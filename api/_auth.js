// Admin auth backed by Supabase Auth (GoTrue). Login / refresh / set-password
// are proxied through our own endpoints; the Supabase access + refresh tokens
// live in httpOnly cookies (never exposed to client JS). All Supabase Auth
// calls use the service key as the apikey — server-side only.

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AT = 'sb_at';
const RT = 'sb_rt';
const MAXAGE = 60 * 60 * 24 * 30; // 30 days (refresh-token lifetime)

function getCookie(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function attrs(req) {
  const host = (req.headers.host || '').toString();
  const secure = !host.startsWith('localhost') && !host.startsWith('127.0.0.1');
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAXAGE}` + (secure ? '; Secure' : '');
}
export function setAuthCookies(res, req, access, refresh) {
  res.setHeader('Set-Cookie', [`${AT}=${access}; ${attrs(req)}`, `${RT}=${refresh}; ${attrs(req)}`]);
}
export function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    `${AT}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    `${RT}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  ]);
}

async function fetchUser(accessToken) {
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, authorization: `Bearer ${accessToken}` } });
  return r.ok ? r.json() : null;
}
async function doRefresh(refreshToken) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: SB_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return r.ok ? r.json() : null;
}

export function roleOf(user) {
  return (user && user.app_metadata && user.app_metadata.role) || 'editor';
}

// Returns the Supabase user (incl. app_metadata.role) or null. Transparently
// refreshes an expired access token and re-sets the cookies when `res` is given.
export async function getAuthedUser(req, res) {
  const at = getCookie(req, AT);
  if (at) { const u = await fetchUser(at); if (u) return u; }
  const rt = getCookie(req, RT);
  if (rt) {
    const data = await doRefresh(rt);
    if (data && data.access_token) {
      if (res) setAuthCookies(res, req, data.access_token, data.refresh_token);
      return data.user || (await fetchUser(data.access_token));
    }
  }
  return null;
}

// Guard: any signed-in user (editor or admin). Sends 401 + returns null if not.
export async function requireUser(req, res) {
  const u = await getAuthedUser(req, res);
  if (!u) { res.status(401).json({ ok: false, error: 'unauthorized' }); return null; }
  return u;
}
// Guard: admin only. Sends 401/403 + returns null otherwise.
export async function requireAdmin(req, res) {
  const u = await getAuthedUser(req, res);
  if (!u) { res.status(401).json({ ok: false, error: 'unauthorized' }); return null; }
  if (roleOf(u) !== 'admin') { res.status(403).json({ ok: false, error: 'forbidden' }); return null; }
  return u;
}
