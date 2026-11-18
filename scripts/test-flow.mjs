import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:5173/?skipintro=1';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
});

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2200));

const out = await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = {};

  res.hud = {
    panels: document.getElementById('stat-panels').textContent,
    ppeChips: [...document.querySelectorAll('#ppe-chips .chip')].map((c) => c.className),
  };
  res.render = { calls: window.__renderer.info.render.calls, tris: window.__renderer.info.render.triangles };

  // mirar a la mesa de EPI y comprobar que el rayo detecta un EPI
  g.goTo(4.2, 8.5, -0.72);
  g.player.camera.rotation.x = -0.22;
  g.player.rig.updateMatrixWorld(true);
  await sleep(250);
  res.pickBench = g.interactions.debugPick();

  // mirar al pulsador de acceso
  g.goTo(-2.75, 7.7, 1.07);
  g.player.camera.rotation.x = -0.62;
  g.player.rig.updateMatrixWorld(true);
  await sleep(250);
  res.pickAccess = g.interactions.debugPick();

  // equipar y subir
  g.equipAll();
  res.ppe = g.ppe.isComplete();
  g.accessRoof();
  res.phase = g.state.phase;
  await sleep(300);

  // coger un panel de verdad (misma ruta que el jugador) y colocarlo
  const panel = g.solar.panels.find((p) => p.userData.state === 'rack');
  res.grab = g.solar.beginHold(panel);
  const slot = g.solar.slots.find((s) => !s.blocked && !s.panel);
  panel.position.copy(slot.position);
  g.player.rig.updateMatrixWorld(true);
  g.player.camera.updateMatrixWorld(true);
  for (let i = 0; i < 8; i++) g.solar.update(0.05);
  res.target = !!g.solar.state.target;
  g.solar.release(panel);
  for (let i = 0; i < 12; i++) g.solar.update(0.05);
  res.placed = g.solar.state.placed;
  res.kwp = g.solar.state.kwp;

  g.debugPlace(12);
  await sleep(500);
  res.placedTotal = g.solar.state.placed;
  g.finish();
  await sleep(500);
  res.phaseEnd = g.state.phase;
  res.result = g.computeResult();
  res.resultsVisible = !document.getElementById('results').classList.contains('hidden');
  res.title = document.getElementById('results-title').textContent;
  return res;
});

console.log(JSON.stringify({ out, errors }, null, 2));
await browser.close();
