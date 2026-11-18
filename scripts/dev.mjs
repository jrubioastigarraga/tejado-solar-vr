import { context } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });

const copyStatic = async () => {
  for (const [from, to] of [
    ['index.html', 'index.html'],
    ['src/style.css', 'style.css'],
    ['public/favicon.svg', 'favicon.svg'],
  ]) {
    try {
      await cp(path.join(root, from), path.join(dist, to));
    } catch {}
  }
};
await copyStatic();

const ctx = await context({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'esm',
  target: ['chrome100'],
  sourcemap: 'inline',
  outfile: path.join(dist, 'app.js'),
  logLevel: 'info',
});
await ctx.watch();

for (const file of ['index.html', 'src/style.css', 'public/favicon.svg']) {
  watch(path.join(root, file), { persistent: true }, () => {
    copyStatic().then(() => console.log(`[static] ${file} actualizado`));
  });
}

const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], {
  stdio: 'inherit',
  env: process.env,
});
server.on('exit', (code) => process.exit(code ?? 0));
