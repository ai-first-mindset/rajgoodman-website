# Pages Builder (admin visual editor bundle)

Out-of-tree build for the admin **Pages** visual editor ([Puck](https://puckeditor.com)).
Produces the committed, deployed artifacts `assets/pages-builder.bundle.{js,css}`,
loaded by `admin/index.html`. This whole `tools/` dir is excluded from the Vercel
deploy via `/.vercelignore`, so the site stays a zero-config static deploy (no root
`package.json`, no build step in CI) — exactly like the vendored `assets/tiptap.bundle.js`.

## Build (only needed when editing `src/`)

```
cd tools/pages-builder
npm install
npm run build     # → ../../assets/pages-builder.bundle.{js,css}
```

Then commit the rebuilt `assets/pages-builder.bundle.*` alongside your `src/` changes.

## What it is

- `src/index.jsx` — IIFE entry → `window.PagesBuilder.{mount,setData,unmount}`; injects `site.css` into Puck's canvas iframe.
- `src/config.jsx` + `src/fields.js` — one Puck component per block type; `fields.js` is plain data (node-testable, drift-guarded against `api/_blocks.js`).
- `src/canvas.jsx` — each block's canvas preview renders through the SAME server renderer, `api/_blocks.js` `renderBlock()` (single source of truth), with live auto-numbering via `usePuck`.
- `src/adapter.js` — lossless `blocks[] ↔ Puck data` (plain ESM, node-testable).

Persistence is unchanged: Puck's `onChange` keeps `PAGE_BLOCKS` current in `admin/admin.js`, which saves via `/api/admin/pages`. The public site renders via `api/_blocks.js` untouched.
