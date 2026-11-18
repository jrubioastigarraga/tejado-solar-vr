import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'esm',
  target: ['chrome100', 'safari16'],
  minify: process.env.NO_MINIFY ? false : true,
  sourcemap: process.env.NO_MINIFY ? 'inline' : false,
  legalComments: 'none',
  outfile: path.join(dist, 'app.js'),
  logLevel: 'info',
});

const staticFiles = [
  ['index.html', 'index.html'],
  ['src/style.css', 'style.css'],
  ['public/favicon.svg', 'favicon.svg'],
];

for (const [from, to] of staticFiles) {
  const src = path.join(root, from);
  if (!existsSync(src)) continue;
  await cp(src, path.join(dist, to));
}

console.log('Build listo en dist/');
