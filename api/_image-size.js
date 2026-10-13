// Intrinsic size of a remote image, read from its first few KB.
//
// The post hero is rendered by the template, not the editor, so it has no
// width/height and the page jumps when it loads (CLS). Featured images don't
// share one aspect ratio, so a fixed box would crop some of them. Instead we
// read the real size from the file header: Supabase storage honours Range, so
// this costs one small request per URL, cached for the life of the instance.
// Any failure returns null and the template simply omits the attributes.

const cache = new Map();
const RANGE_BYTES = 131071; // JPEG SOF can sit behind a large EXIF/ICC block
const TIMEOUT_MS = 1500;

const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u16le = (b, o) => b[o] | (b[o + 1] << 8);
const u24le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32be = (b, o) => ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
const ascii = (b, o, n) => String.fromCharCode(...b.subarray(o, o + n));

// SOFn markers that carry the frame size (excludes DHT C4, JPG C8, DAC CC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function parseImageSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 30) return null;

  // PNG: IHDR is always the first chunk.
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') {
    return ok(u32be(b, 16), u32be(b, 20));
  }
  // GIF: logical screen size.
  if (ascii(b, 0, 4) === 'GIF8') {
    return ok(u16le(b, 6), u16le(b, 8));
  }
  // WebP: RIFF....WEBP then one of three chunk kinds at offset 12.
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const kind = ascii(b, 12, 4);
    if (kind === 'VP8X') return ok(u24le(b, 24) + 1, u24le(b, 27) + 1);
    if (kind === 'VP8L') {
      if (b[20] !== 0x2f) return null;
      const n = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return ok((n & 0x3fff) + 1, ((n >>> 14) & 0x3fff) + 1);
    }
    if (kind === 'VP8 ') {
      if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
      return ok(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
    }
    return null;
  }
  // JPEG: walk the marker segments to the first SOFn.
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }                       // fill byte
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; } // no length
      if (SOF.has(m)) return ok(u16be(b, i + 7), u16be(b, i + 5));
      i += 2 + u16be(b, i + 2);
    }
    return null;
  }
  return null;
}

function ok(w, h) {
  return Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w < 20000 && h < 20000
    ? { width: w, height: h } : null;
}

export async function imageSize(url, fetchImpl = fetch) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
  if (cache.has(url)) return cache.get(url);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let dims = null;
  try {
    const r = await fetchImpl(url, { headers: { Range: `bytes=0-${RANGE_BYTES}` }, signal: ac.signal });
    if (r.ok) dims = parseImageSize(new Uint8Array(await r.arrayBuffer()));
  } catch (e) {
    dims = null;
  } finally {
    clearTimeout(t);
  }
  // Only cache successes, so a transient failure doesn't stick for the instance.
  if (dims) cache.set(url, dims);
  return dims;
}
