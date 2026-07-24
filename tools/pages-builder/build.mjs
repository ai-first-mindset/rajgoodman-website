// Builds the committed admin editor bundle: assets/pages-builder.bundle.{js,css}.
// Out-of-tree (this whole dir is in /.vercelignore); run: npm install && npm run build.
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [join(dir, 'src/index.jsx')],
  bundle: true,
  format: 'iife',
  globalName: 'PagesBuilder',      // → window.PagesBuilder (mirrors the TipTap global pattern)
  jsx: 'automatic',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },       // extracts imported CSS → sibling .css file
  outfile: join(dir, '../../assets/pages-builder.bundle.js'),
  logLevel: 'info',
});

console.log('OK → assets/pages-builder.bundle.{js,css}');
