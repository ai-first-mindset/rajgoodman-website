// GET = who am I (email + role)? ; DELETE = log out.
import { getAuthedUser, roleOf, clearAuthCookies } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    clearAuthCookies(res);
    return res.status(200).json({ ok: true });
  }
  const u = await getAuthedUser(req, res);
  if (!u) return res.status(401).json({ ok: false });
  return res.status(200).json({ ok: true, email: u.email, role: roleOf(u) });
}
