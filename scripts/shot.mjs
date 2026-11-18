import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args[0] || 'http://localhost:5173/?skipintro=1&nohud=1';
const out = args[1] || path.resolve(import.meta.dirname, '..', 'shot.png');
const wait = Number(args[2] || 3500);
const evalJs = args[3] || '';

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error('No encuentro Chrome/Edge');

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--window-size=1400,900',
  ],
  defaultViewport: { width: 1400, height: 900 },
});

const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, wait));
if (evalJs) {
  try {
    await page.evaluate(evalJs);
    await new Promise((r) => setTimeout(r, 1200));
  } catch (e) {
    logs.push(`[evalerror] ${e.message}`);
  }
}
await page.screenshot({ path: out });
console.log(logs.join('\n') || 'sin mensajes de consola');
console.log('captura:', out);
await browser.close();
