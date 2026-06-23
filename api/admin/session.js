// GET = am I logged in? ; DELETE = log out.
import { isAuthed, clearSessionCookie } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  return res.status(isAuthed(req) ? 200 : 401).json({ ok: isAuthed(req) });
}
