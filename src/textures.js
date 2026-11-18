import * as THREE from 'three';

let ANISO = 4;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(c, repeatX = 1, repeatY = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = ANISO;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function cloneRepeat(tex, x, y) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  t.anisotropy = ANISO;
  return t;
}

/* ------------------------------------------------------------------ teja */
function drawRoofTiles() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const rand = rng(7);
  g.fillStyle = '#7e3a24';
  g.fillRect(0, 0, 512, 512);

  const cols = 4;
  const rows = 4;
  const w = 512 / cols;
  const h = 512 / rows;

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (w / 2);
    for (let col = -1; col <= cols; col++) {
      const x = col * w + offset;
      const y = row * h;
      const tone = 0.86 + rand() * 0.22;
      const r = Math.round(158 * tone);
      const gg = Math.round(96 * tone);
      const b = Math.round(74 * tone);

      const grd = g.createLinearGradient(x, 0, x + w, 0);
      grd.addColorStop(0, `rgb(${r * 0.66},${gg * 0.64},${b * 0.66})`);
      grd.addColorStop(0.18, `rgb(${r * 0.86},${gg * 0.84},${b * 0.86})`);
      grd.addColorStop(0.42, `rgb(${Math.min(255, r * 1.1)},${gg * 1.06},${b * 1.04})`);
      grd.addColorStop(0.72, `rgb(${r * 0.92},${gg * 0.88},${b * 0.86})`);
      grd.addColorStop(1, `rgb(${r * 0.58},${gg * 0.55},${b * 0.56})`);

      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x + 1.5, y);
      g.lineTo(x + w - 1.5, y);
      g.lineTo(x + w - 1.5, y + h - 7);
      g.quadraticCurveTo(x + w / 2, y + h + 9, x + 1.5, y + h - 7);
      g.closePath();
      g.fill();

      // sombra de la hilada superior
      g.fillStyle = 'rgba(52,26,16,0.26)';
      g.fillRect(x, y, w, 5);
      // brillo seco
      g.fillStyle = 'rgba(255,224,190,0.05)';
      g.fillRect(x + w * 0.3, y + 2, w * 0.16, h * 0.7);
    }
  }

  // manchas de líquenes y desgaste
  for (let i = 0; i < 240; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1 + rand() * 7;
    g.fillStyle =
      rand() > 0.68
        ? `rgba(120,116,70,${0.05 + rand() * 0.12})`
        : `rgba(40,16,8,${0.04 + rand() * 0.1})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  return c;
}

/* --------------------------------------------------------------- estuco */
function drawStucco() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const rand = rng(21);
  g.fillStyle = '#e9e1d2';
  g.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 24; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 40 + rand() * 130;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const tan = rand() > 0.5;
    grd.addColorStop(0, tan ? 'rgba(198,182,158,0.16)' : 'rgba(255,252,244,0.2)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (let i = 0; i < 7000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const a = 0.015 + rand() * 0.05;
    g.fillStyle = rand() > 0.5 ? `rgba(120,104,80,${a})` : `rgba(255,255,255,${a})`;
    g.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2);
  }

  // regueros suaves
  for (let i = 0; i < 12; i++) {
    const x = rand() * 512;
    g.fillStyle = `rgba(150,138,115,${0.02 + rand() * 0.04})`;
    g.fillRect(x, rand() * 200, 2 + rand() * 8, 120 + rand() * 250);
  }
  return c;
}

/* --------------------------------------------------------------- piedra */
function drawStone() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const rand = rng(33);
  g.fillStyle = '#9d9484';
  g.fillRect(0, 0, 512, 512);

  const rows = 6;
  const h = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 60;
    while (x < 512) {
      const w = 55 + rand() * 70;
      const tone = 0.75 + rand() * 0.4;
      g.fillStyle = `rgb(${Math.round(172 * tone)},${Math.round(162 * tone)},${Math.round(146 * tone)})`;
      g.beginPath();
      g.roundRect(x + 2, r * h + 3, w - 4, h - 6, 5);
      g.fill();
      g.fillStyle = `rgba(255,255,255,${0.08 + rand() * 0.08})`;
      g.fillRect(x + 6, r * h + 6, w - 12, 3);
      x += w;
    }
  }

  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `rgba(60,52,40,${0.02 + rand() * 0.06})`;
    g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 3, 1 + rand() * 3);
  }
  return c;
}

/* ---------------------------------------------------------------- césped */
function drawGrass() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const rand = rng(51);
  g.fillStyle = '#5c7f3f';
  g.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2600; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const a = 0.05 + rand() * 0.2;
    const green = 90 + rand() * 80;
    g.strokeStyle = `rgba(${50 + rand() * 40},${green},${35 + rand() * 30},${a})`;
    g.lineWidth = 1 + rand();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 5, y - 3 - rand() * 8);
    g.stroke();
  }

  for (let i = 0; i < 260; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 8 + rand() * 36;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rand() > 0.5 ? 'rgba(120,130,50,0.12)' : 'rgba(40,70,30,0.16)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

/* --------------------------------------------------------------- gravilla */
function drawGravel() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const rand = rng(71);
  g.fillStyle = '#8b8478';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const t = 0.6 + rand() * 0.7;
    g.fillStyle = `rgb(${Math.round(140 * t)},${Math.round(132 * t)},${Math.round(120 * t)})`;
    const s = 1 + rand() * 4;
    g.beginPath();
    g.ellipse(rand() * 512, rand() * 512, s, s * 0.75, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/* --------------------------------------------------------------- células */
function drawPanel() {
  const c = canvas(1024, 640);
  const g = c.getContext('2d');
  const rand = rng(91);

  const grd = g.createLinearGradient(0, 0, 1024, 640);
  grd.addColorStop(0, '#0b1826');
  grd.addColorStop(0.45, '#102336');
  grd.addColorStop(1, '#0a1522');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 640);

  const cols = 10;
  const rows = 6;
  const pad = 10;
  const gap = 6;
  const cw = (1024 - pad * 2 - gap * (cols - 1)) / cols;
  const ch = (640 - pad * 2 - gap * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = pad + col * (cw + gap);
      const y = pad + r * (ch + gap);
      const cell = g.createLinearGradient(x, y, x + cw, y + ch);
      cell.addColorStop(0, '#1a3a56');
      cell.addColorStop(0.5, '#0e2233');
      cell.addColorStop(1, '#132c42');
      g.fillStyle = cell;
      g.fillRect(x, y, cw, ch);

      // dedos/busbars
      g.fillStyle = 'rgba(190,205,220,0.22)';
      for (let f = 1; f <= 3; f++) {
        g.fillRect(x + (cw / 4) * f, y + 2, 1, ch - 4);
      }
      g.fillStyle = 'rgba(210,225,240,0.3)';
      g.fillRect(x + 3, y + ch / 2 - 1, cw - 6, 1.4);

      g.fillStyle = 'rgba(0,0,0,0.32)';
      g.fillRect(x, y, cw, 1.5);
      g.fillRect(x, y, 1.5, ch);
    }
  }

  // reflejo de cielo
  const sheen = g.createLinearGradient(0, 0, 700, 640);
  sheen.addColorStop(0, 'rgba(150,200,255,0.14)');
  sheen.addColorStop(0.4, 'rgba(150,200,255,0.02)');
  sheen.addColorStop(1, 'rgba(10,20,30,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 1024, 640);

  // suciedad sutil
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(200,210,220,${rand() * 0.03})`;
    g.fillRect(rand() * 1024, rand() * 640, 2, 2);
  }
  return c;
}

/* --------------------------------------------------------------- madera */
function drawWood() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const rand = rng(111);
  g.fillStyle = '#8f6238';
  g.fillRect(0, 0, 512, 512);
  const planks = 5;
  for (let p = 0; p < planks; p++) {
    const y = (p / planks) * 512;
    const t = 0.8 + rand() * 0.35;
    g.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(103 * t)},${Math.round(62 * t)})`;
    g.fillRect(0, y + 2, 512, 512 / planks - 4);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(70,42,20,${0.05 + rand() * 0.16})`;
      g.lineWidth = 0.7 + rand();
      const yy = y + 4 + rand() * (512 / planks - 8);
      g.beginPath();
      g.moveTo(0, yy);
      g.bezierCurveTo(150, yy + (rand() - 0.5) * 8, 340, yy + (rand() - 0.5) * 8, 512, yy);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,22,10,0.5)';
    g.fillRect(0, y, 512, 3);
  }
  return c;
}

/* --------------------------------------------------------------- metal */
function drawMetal() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const rand = rng(131);
  g.fillStyle = '#b4bcc4';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const a = 0.03 + rand() * 0.1;
    g.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(60,70,80,${a})`;
    g.fillRect(0, rand() * 256, 256, 0.6 + rand() * 1.4);
  }
  return c;
}

/* --------------------------------------------------------------- peligro */
function drawHazard() {
  const c = canvas(256, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#f0b429';
  g.fillRect(0, 0, 256, 128);
  g.save();
  g.translate(-64, 0);
  g.rotate(-0.5);
  for (let i = -2; i < 9; i++) {
    g.fillStyle = '#171a1f';
    g.fillRect(i * 64, -60, 30, 300);
  }
  g.restore();
  return c;
}

/* --------------------------------------------------------------- asfalto */
function drawAsphalt() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const rand = rng(151);
  g.fillStyle = '#4b4f52';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) {
    const t = 0.55 + rand() * 0.7;
    g.fillStyle = `rgba(${Math.round(110 * t)},${Math.round(112 * t)},${Math.round(115 * t)},0.7)`;
    g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  return c;
}

export function buildTextures(renderer) {
  ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const roof = texture(drawRoofTiles(), 1, 1);
  const stucco = texture(drawStucco(), 1, 1);
  const stone = texture(drawStone(), 1, 1);
  const grass = texture(drawGrass(), 1, 1);
  const gravel = texture(drawGravel(), 1, 1);
  const cells = texture(drawPanel(), 1, 1);
  const wood = texture(drawWood(), 1, 1);
  const metal = texture(drawMetal(), 1, 1);
  const hazard = texture(drawHazard(), 1, 1);
  const asphalt = texture(drawAsphalt(), 1, 1);
  return { roof, stucco, stone, grass, gravel, cells, wood, metal, hazard, asphalt };
}

/* --------------------------------------------------------------- etiquetas */
export function makeLabelTexture(lines, options = {}) {
  const {
    width = 512,
    height = 256,
    bg = 'rgba(8,14,24,0.92)',
    border = 'rgba(255,194,71,0.55)',
    color = '#eef5ff',
    accent = '#ffc247',
    radius = 26,
    align = 'center',
  } = options;

  const c = canvas(width, height);
  const g = c.getContext('2d');
  g.clearRect(0, 0, width, height);

  if (bg) {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(4, 4, width - 8, height - 8, radius);
    g.fill();
  }
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(4, 4, width - 8, height - 8, radius);
    g.stroke();
  }

  const list = Array.isArray(lines) ? lines : [{ text: lines }];
  const padX = 34;
  let y = 26;
  for (const item of list) {
    const size = item.size || 44;
    g.font = `${item.weight || 700} ${size}px Inter, "Segoe UI", Arial, sans-serif`;
    g.fillStyle = item.color || color;
    g.textAlign = item.align || align;
    g.textBaseline = 'top';
    const x = align === 'left' ? padX : width / 2;
    if (item.accent) g.fillStyle = accent;
    g.fillText(item.text, x, y);
    y += size * 1.22;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ANISO;
  return tex;
}
