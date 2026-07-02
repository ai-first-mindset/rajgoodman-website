// Safe request-body access. Vercel's `req.body` getter THROWS on a request
// whose content-type is JSON but whose body isn't valid JSON — reading it bare
// turns junk input from any bot into a 500 (and kills `vercel dev` locally).
// Always read the body through here: malformed input becomes an empty object,
// which downstream field validation rejects with a proper 4xx.

export function readBody(req) {
  let body;
  try { body = req.body; } catch (e) { return {}; }
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return {}; }
  }
  return (body && typeof body === 'object') ? body : {};
}
