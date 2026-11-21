/**
 * Exporta árboles generados con EZ-Tree a GLB para usarlos en Unity.
 * Se ejecuta desde la carpeta del proyecto tejado-solar-vr (tiene three y ez-tree):
 *   node ..\tejado-solar-unity\export-trees.mjs
 */
import esbuild from 'esbuild';
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const unityDir = process.env.UNITY_PROJECT || path.resolve(process.cwd(), '..', 'tejado-solar-unity');
const outDir = path.join(unityDir, 'Assets', 'Resources', 'Models');
const tmp = path.join(unityDir, '.tree-export');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });

const entry = `
import * as THREE from 'three';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
window.__exportTree = (preset, height, overrides) => new Promise((resolve) => {
  const tree = new Tree(structuredClone(TreePreset[preset]));
  if (overrides) Object.assign(tree.options.leaves, overrides);
  tree.generate();
  // simplificar materiales: solo albedo a 256px (los 4 mapas 1K pesaban ~7MB por árbol)
  tree.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    const mat = new THREE.MeshStandardMaterial({
      color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
      roughness: 0.92,
      metalness: 0,
      alphaTest: src.alphaTest || 0,
      side: src.side,
    });
    if (src.map && src.map.image) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(src.map.image, 0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = src.map.flipY;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      mat.map = t;
    }
    o.material = mat;
  });
  const box = new THREE.Box3().setFromObject(tree);
  const h = Math.max(0.001, box.max.y - box.min.y);
  const k = height / h;
  tree.scale.setScalar(k);
  tree.position.y = -box.min.y * k;
  tree.updateMatrixWorld(true);
  new GLTFExporter().parse(tree, (glb) => {
    const bytes = new Uint8Array(glb);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    resolve(btoa(bin));
  }, (err) => resolve('ERROR:' + String(err)), { binary: true });
});
`;

await esbuild.build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'js' },
  bundle: true,
  format: 'esm',
  outfile: path.join(tmp, 'bundle.js'),
  logLevel: 'silent',
});

fs.writeFileSync(
  path.join(tmp, 'index.html'),
  '<!doctype html><meta charset="utf-8"><script type="module" src="./bundle.js"></script>',
);

const server = http.createServer((req, res) => {
  const file = path.join(tmp, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });

const exports = [
  ['Oak Large', 'Tree_OakLarge', 7.5, null],
  ['Oak Medium', 'Tree_OakMedium', 5.2, null],
  ['Ash Medium', 'Tree_Sakura', 5.4, { count: 30, size: 2.6 }],
  ['Bush 2', 'Bush_01', 1.3, { count: 20 }],
];

for (const [preset, name, height, overrides] of exports) {
  const b64 = await page.evaluate(
    (p, h, o) => window.__exportTree(p, h, o),
    preset,
    height,
    overrides,
  );
  if (typeof b64 === 'string' && b64.startsWith('ERROR:')) {
    console.error(name, b64);
    continue;
  }
  const file = path.join(outDir, `${name}.glb`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(name, (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
}

await browser.close();
server.close();
fs.rmSync(tmp, { recursive: true, force: true });


