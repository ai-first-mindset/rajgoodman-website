// Tests for the media library (list/metadata/delete/replace), the signed
// upload endpoint, the LinkedIn admin CRUD, and the shared orphan-cleanup
// helpers — all against a routed Supabase stub (GoTrue + PostgREST + Storage).
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_SECRET_KEY = 'sb-secret';
const { default: media } = await import('../api/admin/media.js');
const { default: upload } = await import('../api/admin/upload.js');
const { default: linkedin } = await import('../api/admin/linkedin.js');
const { bucketPath, isReferenced } = await import('../api/_media.js');

const PUB = 'https://sb.test/storage/v1/object/public/blog-media/';

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const req = (method, { body, cookie = 'sb_at=good-token' } = {}) =>
  ({ method, body, headers: { cookie, host: 'localhost:3000' }, url: '/x', socket: {} });

const realFetch = globalThis.fetch;
let calls, role, inUsePosts, liReferences, postReferences, storageDeletes, usedInFail, refCheckFail;
beforeEach(() => {
  calls = []; role = 'admin'; inUsePosts = []; liReferences = false; postReferences = false; storageDeletes = [];
  usedInFail = false; refCheckFail = false;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body && typeof opts.body === 'string' && opts.body.startsWith('{') ? JSON.parse(opts.body) : opts.body;
    calls.push({ url: u, method, body, headers: opts.headers || {} });

    // GoTrue
    if (u.includes('/auth/v1/user')) {
      const ok = (opts.headers.authorization || '') === 'Bearer good-token';
      return { ok, json: async () => ({ id: 'me-1', app_metadata: { role } }) };
    }
    if (u.includes('/auth/v1/token')) return { ok: false, json: async () => ({}) };

    // Storage
    if (u.includes('/storage/v1/object/upload/sign/')) {
      return { ok: true, json: async () => ({ url: '/object/upload/sign/blog-media/x?token=sig' }), text: async () => '' };
    }
    if (u.includes('/storage/v1/object/list/blog-media')) {
      const prefix = body.prefix || '';
      if (prefix === '') return { ok: true, json: async () => ([
        { name: 'hero.png', id: 'o1', created_at: '2026-07-01', metadata: { size: 999 } },
        { name: 'wp-content', id: null },
      ]) };
      if (prefix === 'wp-content/') return { ok: true, json: async () => ([{ name: 'old.jpg', id: 'o2', created_at: '2026-06-01', metadata: { size: 5 } }]) };
      return { ok: true, json: async () => [] };
    }
    if (u.includes('/storage/v1/object/blog-media/') && method === 'DELETE') {
      storageDeletes.push(decodeURIComponent(u.split('/storage/v1/object/blog-media/')[1]));
      assert.equal(opts.headers['content-type'], undefined, 'storage DELETE must not send a content-type');
      return { ok: true, text: async () => '' };
    }

    // PostgREST
    if (u.includes('/rest/v1/media')) {
      if (method === 'POST') return { ok: true, json: async () => [body], text: async () => '' };
      if (method === 'DELETE') return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [{ path: 'hero.png', alt: 'A hero image', caption: null, title: null }] };
    }
    if (u.includes('/rest/v1/linkedin_posts')) {
      if (method === 'PATCH' && u.includes('image_url=eq.')) return { ok: true, json: async () => [{ id: 7 }] }; // repointExact
      if (u.includes('select=image_url')) return { ok: true, json: async () => [{ image_url: PUB + 'li-old.png' }] };
      if (u.includes('select=id&limit=1')) return { ok: !refCheckFail, json: async () => (liReferences ? [{ id: 1 }] : []) };
      if (method === 'PATCH') return { ok: true, json: async () => [{ id: 5, image_url: PUB + 'li-new.png' }], text: async () => '' };
      if (method === 'POST') return { ok: true, json: async () => [{ id: 9, ...body }], text: async () => '' };
      if (method === 'DELETE') return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [], text: async () => '' };
    }
    if (u.includes('/rest/v1/posts')) {
      if (u.includes('select=id,title,slug')) return { ok: !usedInFail, json: async () => inUsePosts }; // usedIn
      if (u.includes('select=id&limit=1')) return { ok: !refCheckFail, json: async () => (postReferences ? [{ id: 'p' }] : []) }; // isReferenced
      if (u.includes('select=id,body_html')) return { ok: true, json: async () => [{ id: 'p1', body_html: `<img src="${PUB}old-img.png">`, featured_image: null, og_image: null }] }; // repointPosts
      if (method === 'PATCH') return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    }
    throw new Error('unexpected fetch ' + u);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

/* ---- upload ---- */
test('upload: 401 without auth; 415 on unsupported type; 405 non-POST', async () => {
  let res = makeRes();
  await upload(req('POST', { cookie: '', body: { filename: 'x.png', contentType: 'image/png' } }), res);
  assert.equal(res.statusCode, 401);
  res = makeRes();
  await upload(req('POST', { body: { filename: 'x.svg', contentType: 'image/svg+xml' } }), res);
  assert.equal(res.statusCode, 415); // SVG deliberately refused
  res = makeRes();
  await upload(req('GET'), res);
  assert.equal(res.statusCode, 405);
});

test('upload: 201 with slugged filename, MIME-derived extension, absolute signed URL', async () => {
  const res = makeRes();
  await upload(req('POST', { body: { filename: 'Raj’s Photo (final) v2.JPEG', contentType: 'image/jpeg' } }), res);
  assert.equal(res.statusCode, 201);
  assert.match(res.body.path, /^[a-z0-9]+-raj-s-photo-final-v2\.jpg$/);
  assert.equal(res.body.signedUrl, 'https://sb.test/storage/v1/object/upload/sign/blog-media/x?token=sig');
  assert.equal(res.body.publicUrl, PUB + res.body.path);
});

/* ---- media library ---- */
test('media GET: recursive listing merged with the metadata overlay', async () => {
  const res = makeRes();
  await media(req('GET'), res);
  assert.equal(res.statusCode, 200);
  const byPath = Object.fromEntries(res.body.files.map((f) => [f.path, f]));
  assert.equal(byPath['hero.png'].alt, 'A hero image');
  assert.ok(byPath['wp-content/old.jpg'], 'nested folder file surfaced');
  assert.equal(byPath['hero.png'].url, PUB + 'hero.png');
});

test('media PATCH: path required, then metadata upserted on conflict', async () => {
  let res = makeRes();
  await media(req('PATCH', { body: { alt: 'no path' } }), res);
  assert.equal(res.body.error, 'path-required');
  res = makeRes();
  await media(req('PATCH', { body: { path: 'hero.png', alt: 'Better alt' } }), res);
  assert.equal(res.statusCode, 200);
  const upsert = calls.find((c) => c.url.includes('on_conflict=path'));
  assert.equal(upsert.body.alt, 'Better alt');
});

test('media DELETE: editors forbidden; in-use files refuse with the posts; force overrides', async () => {
  role = 'editor';
  let res = makeRes();
  await media(req('DELETE', { body: { path: 'hero.png' } }), res);
  assert.equal(res.statusCode, 403);

  role = 'admin';
  inUsePosts = [{ id: 'p1', title: 'Uses it', slug: 'uses-it' }];
  res = makeRes();
  await media(req('DELETE', { body: { path: 'hero.png' } }), res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body.posts, inUsePosts);
  assert.equal(storageDeletes.length, 0);

  res = makeRes();
  await media(req('DELETE', { body: { path: 'hero.png', force: true } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(storageDeletes, ['hero.png']);
});

test('media replace: admin-only, repoints LinkedIn + posts, removes the orphaned old file', async () => {
  role = 'editor';
  let res = makeRes();
  await media(req('POST', { body: { action: 'replace', oldPath: 'old-img.png', newPath: 'new-img.png' } }), res);
  assert.equal(res.statusCode, 403);

  role = 'admin';
  res = makeRes();
  await media(req('POST', { body: { action: 'replace', oldPath: 'same.png', newPath: 'same.png' } }), res);
  assert.equal(res.body.error, 'same-path');

  res = makeRes();
  await media(req('POST', { body: { action: 'replace', oldPath: 'old-img.png', newPath: 'new-img.png' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.counts, { linkedin: 1, posts: 1 });
  assert.equal(res.body.url, PUB + 'new-img.png');
  const postPatch = calls.find((c) => c.url.includes('/rest/v1/posts?id=eq.p1'));
  assert.ok(postPatch.body.body_html.includes(PUB + 'new-img.png'), 'body_html rewritten to the new URL');
  assert.deepEqual(storageDeletes, ['old-img.png'], 'old object removed once orphaned');
});

/* ---- LinkedIn admin ---- */
const LI_URL = 'https://www.linkedin.com/feed/update/urn:li:activity:7487532804604497920/';

test('linkedin POST: url required; non-allow-listed fields are stripped', async () => {
  let res = makeRes();
  await linkedin(req('POST', { body: { title: 'no url' } }), res);
  assert.equal(res.body.error, 'url-required');
  res = makeRes();
  await linkedin(req('POST', { body: { url: LI_URL, title: 'T', evil: 'x', id: 'attacker' } }), res);
  assert.equal(res.statusCode, 201);
  const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/rest/v1/linkedin_posts'));
  assert.deepEqual(create.body, { url: LI_URL, title: 'T' });
});

/* The homepage assigns url -> a.href and image_url -> img.src with no CSP, and
   this endpoint is driven by the unattended sync agent that reads untrusted
   text off linkedin.com. So both fields are constrained server-side. */
test('linkedin POST: url must be an https www.linkedin.com URL', async () => {
  for (const url of [
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example.com/phish',
    'http://www.linkedin.com/feed/update/urn:li:activity:1/',
    'https://www.linkedin.com.evil.example.com/x',
    'not a url',
  ]) {
    const res = makeRes();
    await linkedin(req('POST', { body: { url, title: 'T' } }), res);
    assert.equal(res.statusCode, 422, `should reject ${url}`);
    assert.ok(/^url-(invalid|not-linkedin)$/.test(res.body.error), `${url} -> ${res.body.error}`);
  }
});

test('linkedin POST: image_url must be site-relative or our own bucket', async () => {
  for (const image_url of [
    'https://tracker.example.com/beacon.gif',
    '//tracker.example.com/beacon.gif',
    'javascript:alert(1)',
    'https://sb.evil.com/storage/v1/object/public/blog-media/x.jpg',
  ]) {
    const res = makeRes();
    await linkedin(req('POST', { body: { url: LI_URL, image_url } }), res);
    assert.equal(res.statusCode, 422, `should reject ${image_url}`);
    assert.equal(res.body.error, 'image-url-not-allowed');
  }
  for (const image_url of [PUB + 'ok.jpg', '/assets/li/card.png', '']) {
    const res = makeRes();
    await linkedin(req('POST', { body: { url: LI_URL, image_url } }), res);
    assert.equal(res.statusCode, 201, `should accept ${JSON.stringify(image_url)}`);
  }
});

test('linkedin PATCH: validates only the fields being patched', async () => {
  // The visibility toggle and reorder arrows send id + one field, and must
  // not start failing just because they carry no url/image_url.
  let res = makeRes();
  await linkedin(req('PATCH', { body: { id: 5, visible: false } }), res);
  assert.equal(res.statusCode, 200);
  res = makeRes();
  await linkedin(req('PATCH', { body: { id: 5, sort_order: 3 } }), res);
  assert.equal(res.statusCode, 200);
  // But a hostile value on PATCH is rejected like it is on POST.
  res = makeRes();
  await linkedin(req('PATCH', { body: { id: 5, url: 'javascript:alert(1)' } }), res);
  assert.equal(res.statusCode, 422);
  res = makeRes();
  await linkedin(req('PATCH', { body: { id: 5, image_url: 'https://tracker.example.com/b.gif' } }), res);
  assert.equal(res.statusCode, 422);
});

test('linkedin PATCH: changing the image cleans up the orphaned old file', async () => {
  const res = makeRes();
  await linkedin(req('PATCH', { body: { id: 5, image_url: PUB + 'li-new.png' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(storageDeletes, ['li-old.png']);
});

test('linkedin PATCH: a still-referenced old image is NOT deleted', async () => {
  liReferences = true;
  const res = makeRes();
  await linkedin(req('PATCH', { body: { id: 5, image_url: PUB + 'li-new.png' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(storageDeletes.length, 0);
});

test('linkedin DELETE: admin-only', async () => {
  role = 'editor';
  const res = makeRes();
  await linkedin(req('DELETE', { body: { id: 5 } }), res);
  assert.equal(res.statusCode, 403);
});

/* ---- fail-closed deletion guards ---- */
test('media DELETE: a failed in-use check refuses the delete (502), never falls through', async () => {
  usedInFail = true;
  const res = makeRes();
  await media(req('DELETE', { body: { path: 'hero.png' } }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'in-use-check-failed');
  assert.equal(storageDeletes.length, 0, 'file untouched');
});

test('linkedin PATCH: failed reference checks keep the old image (fail closed)', async () => {
  refCheckFail = true;
  const res = makeRes();
  await linkedin(req('PATCH', { body: { id: 5, image_url: PUB + 'li-new.png' } }), res);
  assert.equal(res.statusCode, 200, 'update itself still succeeds');
  assert.equal(storageDeletes.length, 0, 'old image NOT deleted on a check failure');
});

test('isReferenced: a failing check reports "referenced" instead of deletable', async () => {
  refCheckFail = true;
  assert.equal(await isReferenced(PUB + 'any.png'), true);
});

test('cleanupIfOrphan: a thrown check keeps the file and reports not-deleted', async () => {
  globalThis.fetch = async () => { throw new Error('supabase down'); };
  const { cleanupIfOrphan } = await import('../api/_media.js');
  assert.equal(await cleanupIfOrphan(PUB + 'any.png'), false);
});

/* ---- shared media helpers ---- */
test('bucketPath: extracts our bucket paths, strips queries, rejects foreign URLs', () => {
  assert.equal(bucketPath(PUB + 'a/b.png?v=2'), 'a/b.png');
  assert.equal(bucketPath('https://elsewhere.com/img.png'), null);
  assert.equal(bucketPath(null), null);
});

test('isReferenced: foreign URLs are always "referenced" (never deletable)', async () => {
  globalThis.fetch = async () => { throw new Error('must not fetch for foreign URLs'); };
  assert.equal(await isReferenced('https://elsewhere.com/img.png'), true);
});
