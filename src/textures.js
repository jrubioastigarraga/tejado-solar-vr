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

/** Normal map tangente a partir de la luminancia (relieve aproximado). */
function normalFrom(src, strength) {
  const w = src.width;
  const h = src.height;
  const data = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }
  const out = canvas(w, h);
  const g = out.getContext('2d');
  const img = g.createImageData(w, h);
  const at = (x, y) => lum[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

function normalTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = ANISO;
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

/* ------------------------------------------------------------------ tejas */
function drawRoofTiles() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(7);

  g.fillStyle = '#5f2d1c';
  g.fillRect(0, 0, S, S);

  const cols = 5;
  const rows = 6;
  const w = S / cols;
  const h = S / rows;

  // tono estable por teja: así el patrón cierra al repetirse
  const tones = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0.78 + rand() * 0.36),
  );

  for (let row = -1; row <= rows; row++) {
    const offset = (((row % 2) + 2) % 2) * (w / 2);
    const toneRow = tones[((row % rows) + rows) % rows];
    for (let col = -1; col <= cols; col++) {
      const ci = ((col % cols) + cols) % cols;
      const x = col * w + offset;
      const y = row * h;
      const tone = toneRow[ci];
      const r = Math.min(255, 182 * tone);
      const gg = Math.min(255, 98 * tone);
      const b = Math.min(255, 68 * tone);

      // caña de la teja árabe: sombra en los bordes, luz en el centro
      const grd = g.createLinearGradient(x, 0, x + w, 0);
      grd.addColorStop(0, `rgb(${r * 0.46 | 0},${gg * 0.44 | 0},${b * 0.44 | 0})`);
      grd.addColorStop(0.14, `rgb(${r * 0.72 | 0},${gg * 0.7 | 0},${b * 0.72 | 0})`);
      grd.addColorStop(0.38, `rgb(${r * 1.02 | 0},${gg * 1.0 | 0},${b * 0.98 | 0})`);
      grd.addColorStop(0.52, `rgb(${Math.min(255, r * 1.16) | 0},${Math.min(255, gg * 1.12) | 0},${b * 1.05 | 0})`);
      grd.addColorStop(0.78, `rgb(${r * 0.9 | 0},${gg * 0.86 | 0},${b * 0.84 | 0})`);
      grd.addColorStop(1, `rgb(${r * 0.42 | 0},${gg * 0.4 | 0},${b * 0.4 | 0})`);

      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x + 1.5, y - 1);
      g.lineTo(x + w - 1.5, y - 1);
      g.lineTo(x + w - 1.5, y + h - 8);
      g.quadraticCurveTo(x + w / 2, y + h + 10, x + 1.5, y + h - 8);
      g.closePath();
      g.fill();

      // labio inferior y sombra de la hilada
      g.fillStyle = 'rgba(40,17,9,0.34)';
      g.fillRect(x, y - 1, w, 4);
      g.fillStyle = 'rgba(255,228,196,0.07)';
      g.fillRect(x + w * 0.3, y + 3, w * 0.13, h * 0.62);

      // desconchones y grietas puntuales
      if (rand() > 0.82) {
        g.fillStyle = `rgba(${88 + rand() * 30 | 0},${52 + rand() * 20 | 0},${38 | 0},0.5)`;
        const cx = x + w * (0.2 + rand() * 0.6);
        const cy = y + h * (0.3 + rand() * 0.5);
        g.beginPath();
        g.ellipse(cx, cy, 2 + rand() * 5, 1 + rand() * 3, rand() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // líquenes, musgo y regueros de desgaste
  for (let i = 0; i < 320; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 1 + rand() * 8;
    const moss = rand() > 0.62;
    g.fillStyle = moss
      ? `rgba(${118 + rand() * 40 | 0},${112 + rand() * 34 | 0},${58 + rand() * 30 | 0},${0.05 + rand() * 0.16})`
      : `rgba(36,15,8,${0.04 + rand() * 0.12})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * S;
    const grd = g.createLinearGradient(x, 0, x, S);
    grd.addColorStop(0, 'rgba(30,14,8,0.12)');
    grd.addColorStop(1, 'rgba(30,14,8,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, 1 + rand() * 3, S);
  }
  return c;
}

/* --------------------------------------------------------------- kawara */
function drawKawara() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(13);

  g.fillStyle = '#232c34';
  g.fillRect(0, 0, S, S);

  const cols = 6;
  const rows = 7;
  const w = S / cols;
  const h = S / rows;

  const tones = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0.8 + rand() * 0.34),
  );

  for (let row = -1; row <= rows; row++) {
    const offset = (((row % 2) + 2) % 2) * (w / 2);
    const toneRow = tones[((row % rows) + rows) % rows];
    for (let col = -1; col <= cols; col++) {
      const ci = ((col % cols) + cols) % cols;
      const x = col * w + offset;
      const y = row * h;
      const tone = toneRow[ci];
      const r = 74 * tone;
      const gg = 90 * tone;
      const b = 104 * tone;

      // media caña de cerámica, brillo central y sombra en los bordes
      const grd = g.createLinearGradient(x, 0, x + w, 0);
      grd.addColorStop(0, `rgb(${r * 0.38 | 0},${gg * 0.4 | 0},${b * 0.44 | 0})`);
      grd.addColorStop(0.16, `rgb(${r * 0.72 | 0},${gg * 0.74 | 0},${b * 0.8 | 0})`);
      grd.addColorStop(0.42, `rgb(${Math.min(255, r * 1.22) | 0},${Math.min(255, gg * 1.2) | 0},${Math.min(255, b * 1.16) | 0})`);
      grd.addColorStop(0.6, `rgb(${r * 1.02 | 0},${gg * 1.02 | 0},${b * 1.02 | 0})`);
      grd.addColorStop(1, `rgb(${r * 0.34 | 0},${gg * 0.36 | 0},${b * 0.4 | 0})`);

      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x + 1.5, y - 1);
      g.lineTo(x + w - 1.5, y - 1);
      g.lineTo(x + w - 1.5, y + h - 6);
      g.quadraticCurveTo(x + w / 2, y + h + 8, x + 1.5, y + h - 6);
      g.closePath();
      g.fill();

      g.fillStyle = 'rgba(8,12,16,0.4)';
      g.fillRect(x, y - 1, w, 4);
      g.fillStyle = 'rgba(210,230,245,0.09)';
      g.fillRect(x + w * 0.34, y + 3, w * 0.1, h * 0.5);

      // musgo y cal en las juntas
      if (rand() > 0.84) {
        g.fillStyle = `rgba(${74 + rand() * 30 | 0},${92 + rand() * 26 | 0},${58 + rand() * 20 | 0},${0.1 + rand() * 0.18})`;
        g.beginPath();
        g.arc(x + w * rand(), y + h * rand(), 1 + rand() * 4, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // brillo húmedo y regueros
  for (let i = 0; i < 34; i++) {
    const x = rand() * S;
    const grd = g.createLinearGradient(x, 0, x, S);
    grd.addColorStop(0, `rgba(200,225,240,${0.03 + rand() * 0.05})`);
    grd.addColorStop(1, 'rgba(200,225,240,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, 1 + rand() * 2, S);
  }
  return c;
}

/* --------------------------------------------------------------- estuco */
function drawStucco() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(21);
  g.fillStyle = '#e9e1d2';
  g.fillRect(0, 0, S, S);

  for (let i = 0; i < 34; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 34 + rand() * 150;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const tan = rand() > 0.5;
    grd.addColorStop(0, tan ? 'rgba(196,180,156,0.2)' : 'rgba(255,253,246,0.24)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // grano fino
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {

    const n = (rand() - 0.5) * 16;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.8));
  }
  g.putImageData(img, 0, 0);

  // marcas de llana
  for (let i = 0; i < 26; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const rad = 26 + rand() * 90;
    g.strokeStyle = `rgba(255,255,255,${0.05 + rand() * 0.09})`;
    g.lineWidth = 1 + rand() * 2;
    g.beginPath();
    g.arc(x, y, rad, rand() * Math.PI, rand() * Math.PI + 1.2);
    g.stroke();
  }

  // grietas capilares
  for (let i = 0; i < 9; i++) {
    let x = rand() * S;
    let y = rand() * S;
    g.strokeStyle = `rgba(120,104,86,${0.08 + rand() * 0.1})`;
    g.lineWidth = 0.7 + rand();
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rand() - 0.5) * 26;
      y += 8 + rand() * 22;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // regueros suaves
  for (let i = 0; i < 14; i++) {
    const x = rand() * S;
    g.fillStyle = `rgba(148,136,114,${0.02 + rand() * 0.045})`;
    g.fillRect(x, rand() * 220, 2 + rand() * 9, 110 + rand() * 260);
  }
  return c;
}

/* --------------------------------------------------------------- piedra */
function drawStone() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(33);
  g.fillStyle = '#a89d8b';
  g.fillRect(0, 0, S, S);

  const rows = 6;
  const h = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 70;
    while (x < S) {
      const w = 52 + rand() * 78;
      const tone = 0.7 + rand() * 0.42;
      const baseR = 176 * tone;
      const baseG = 168 * tone;
      const baseB = 152 * tone;

      // silueta irregular del mampuesto
      g.beginPath();
      g.moveTo(x + 3, r * h + 4 + rand() * 3);
      g.quadraticCurveTo(x + w * 0.5, r * h + 2 + rand() * 4, x + w - 3, r * h + 4 + rand() * 3);
      g.quadraticCurveTo(x + w - 1, r * h + h * 0.5, x + w - 3, r * h + h - 4 - rand() * 3);
      g.quadraticCurveTo(x + w * 0.5, r * h + h - 2 - rand() * 3, x + 3, r * h + h - 4 - rand() * 3);
      g.quadraticCurveTo(x + 1, r * h + h * 0.5, x + 3, r * h + 4 + rand() * 3);
      g.closePath();
      g.fillStyle = `rgb(${baseR | 0},${baseG | 0},${baseB | 0})`;
      g.fill();

      // bisel superior iluminado y sombra inferior
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x + 6, r * h + 6);
      g.lineTo(x + w - 6, r * h + 6);
      g.stroke();
      g.strokeStyle = 'rgba(52,44,32,0.4)';
      g.beginPath();
      g.moveTo(x + 6, r * h + h - 6);
      g.lineTo(x + w - 6, r * h + h - 6);
      g.stroke();

      // poros y vetas de la piedra
      for (let i = 0; i < 22; i++) {
        g.fillStyle = `rgba(${70 + rand() * 50 | 0},${64 + rand() * 40 | 0},${52 + rand() * 30 | 0},${0.04 + rand() * 0.1})`;
        g.fillRect(x + 5 + rand() * (w - 10), r * h + 5 + rand() * (h - 10), 1 + rand() * 2.5, 1 + rand() * 1.5);
      }
      x += w;
    }
  }

  // musgo y líquenes en las juntas
  for (let i = 0; i < 90; i++) {
    const x = rand() * S;
    const y = (Math.floor(rand() * rows) * h) + (rand() > 0.5 ? 2 : h - 3);
    const r = 1 + rand() * 5;
    g.fillStyle = `rgba(${96 + rand() * 40 | 0},${108 + rand() * 30 | 0},${62 + rand() * 24 | 0},${0.07 + rand() * 0.13})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/* --------------------------------------------------------------- césped */
function drawGrass() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(51);
  g.fillStyle = '#62843f';
  g.fillRect(0, 0, S, S);

  // manchas de tono
  for (let i = 0; i < 300; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 10 + rand() * 46;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rand() > 0.5 ? 'rgba(126,142,58,0.16)' : 'rgba(42,74,32,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // briznas con base oscura y punta clara
  for (let i = 0; i < 4200; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const len = 3 + rand() * 9;
    const lean = (rand() - 0.5) * 6;
    const light = 80 + rand() * 90;
    g.strokeStyle = `rgba(${40 + rand() * 34 | 0},${light | 0},${30 + rand() * 26 | 0},${0.32 + rand() * 0.5})`;
    g.lineWidth = 0.8 + rand() * 1.3;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * 0.4, y - len * 0.55, x + lean, y - len);
    g.stroke();
  }

  // tréboles y florecillas
  for (let i = 0; i < 60; i++) {
    const x = rand() * S;
    const y = rand() * S;
    g.fillStyle = `rgba(${168 + rand() * 60 | 0},${168 + rand() * 50 | 0},${70 + rand() * 40 | 0},0.5)`;
    g.beginPath();
    g.arc(x, y, 0.8 + rand() * 1.3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/* --------------------------------------------------------------- gravilla */
function drawGravel() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(71);
  g.fillStyle = '#827b6e';
  g.fillRect(0, 0, S, S);

  for (let i = 0; i < 3400; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const rx = 1.2 + rand() * 4.6;
    const ry = rx * (0.6 + rand() * 0.5);
    const tone = 0.55 + rand() * 0.75;
    const rot = rand() * Math.PI;

    // sombra proyectada
    g.fillStyle = 'rgba(30,26,20,0.35)';
    g.beginPath();
    g.ellipse(x + 1.2, y + 1.4, rx, ry, rot, 0, Math.PI * 2);
    g.fill();

    const grd = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    grd.addColorStop(0, `rgb(${170 * tone | 0},${160 * tone | 0},${142 * tone | 0})`);
    grd.addColorStop(1, `rgb(${96 * tone | 0},${90 * tone | 0},${80 * tone | 0})`);
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.14})`;
    g.beginPath();
    g.ellipse(x - rx * 0.28, y - ry * 0.3, rx * 0.34, ry * 0.28, rot, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/* --------------------------------------------------------------- células */
function drawPanel() {
  const W = 1024;
  const H = 640;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rand = rng(91);

  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#0a1624');
  grd.addColorStop(0.45, '#0f2437');
  grd.addColorStop(1, '#081320');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  const cols = 10;
  const rows = 6;
  const pad = 9;
  const gap = 6;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const ch = (H - pad * 2 - gap * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = pad + col * (cw + gap);
      const y = pad + r * (ch + gap);
      const tone = 0.85 + rand() * 0.32;

      const cell = g.createLinearGradient(x, y, x + cw, y + ch);
      cell.addColorStop(0, `rgb(${26 * tone | 0},${58 * tone | 0},${86 * tone | 0})`);
      cell.addColorStop(0.5, `rgb(${13 * tone | 0},${33 * tone | 0},${50 * tone | 0})`);
      cell.addColorStop(1, `rgb(${19 * tone | 0},${44 * tone | 0},${67 * tone | 0})`);
      g.fillStyle = cell;
      g.fillRect(x, y, cw, ch);

      // dedos (finger grid)
      g.fillStyle = 'rgba(176,196,214,0.16)';
      for (let f = 1; f < 10; f++) {
        g.fillRect(x + (cw / 10) * f, y + 2, 0.8, ch - 4);
      }
      // 3 busbars
      g.fillStyle = 'rgba(206,220,234,0.34)';
      for (let b = 1; b <= 3; b++) {
        g.fillRect(x + 2, y + (ch / 4) * b - 1, cw - 4, 1.6);
      }
      // sombra de separación
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x, y, cw, 1.6);
      g.fillRect(x, y, 1.6, ch);
      // brillo de esquina
      g.fillStyle = 'rgba(190,225,255,0.05)';
      g.fillRect(x + cw * 0.6, y, cw * 0.4, ch);
    }
  }

  // reflejo de cielo y velo antirreflejante
  const sheen = g.createLinearGradient(0, 0, 720, H);
  sheen.addColorStop(0, 'rgba(150,200,255,0.16)');
  sheen.addColorStop(0.45, 'rgba(150,200,255,0.03)');
  sheen.addColorStop(1, 'rgba(10,20,30,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, W, H);

  // polvo y microarañazos
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(210,220,232,${rand() * 0.035})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let i = 0; i < 24; i++) {
    g.strokeStyle = `rgba(220,232,244,${0.02 + rand() * 0.04})`;
    g.lineWidth = 0.6;
    const x = rand() * W;
    const y = rand() * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 12 + rand() * 40, y + (rand() - 0.5) * 10);
    g.stroke();
  }
  return c;
}

/* --------------------------------------------------------------- polvo */
function drawDust() {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(404);
  g.clearRect(0, 0, S, S);

  for (let i = 0; i < 46; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 10 + rand() * 46;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${150 + rand() * 40 | 0},${124 + rand() * 34 | 0},${88 + rand() * 26 | 0},${0.1 + rand() * 0.18})`);
    grd.addColorStop(1, 'rgba(150,124,88,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(${146 + rand() * 40 | 0},${122 + rand() * 34 | 0},${88 + rand() * 26 | 0},${0.05 + rand() * 0.16})`;
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 3, 1 + rand() * 2);
  }
  return c;
}

/* --------------------------------------------------------------- madera */
function drawWood() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(111);
  g.fillStyle = '#8a5c34';
  g.fillRect(0, 0, S, S);

  const planks = 5;
  for (let p = 0; p < planks; p++) {
    const y = (p / planks) * S;
    const t = 0.78 + rand() * 0.38;
    g.fillStyle = `rgb(${150 * t | 0},${102 * t | 0},${60 * t | 0})`;
    g.fillRect(0, y + 2, S, S / planks - 4);

    // veta
    for (let i = 0; i < 90; i++) {
      const yy = y + 4 + rand() * (S / planks - 8);
      g.strokeStyle = `rgba(${54 + rand() * 36 | 0},${30 + rand() * 22 | 0},${14 + rand() * 12 | 0},${0.05 + rand() * 0.17})`;
      g.lineWidth = 0.6 + rand() * 1.3;
      g.beginPath();
      g.moveTo(0, yy);
      g.bezierCurveTo(
        150,
        yy + (rand() - 0.5) * 10,
        340,
        yy + (rand() - 0.5) * 10,
        S,
        yy + (rand() - 0.5) * 5,
      );
      g.stroke();
    }

    // nudos
    if (rand() > 0.35) {
      const kx = 40 + rand() * (S - 80);
      const ky = y + 10 + rand() * (S / planks - 20);
      for (let k = 4; k >= 1; k--) {
        g.strokeStyle = `rgba(${48 + rand() * 24 | 0},${26 + rand() * 14 | 0},${12 | 0},${0.18 + k * 0.07})`;
        g.lineWidth = 1 + k * 0.5;
        g.beginPath();
        g.ellipse(kx, ky, k * 2.2, k * 1.2, 0.2, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = 'rgba(40,22,10,0.55)';
      g.beginPath();
      g.ellipse(kx, ky, 2.4, 1.4, 0.2, 0, Math.PI * 2);
      g.fill();
    }

    // junta y sombra entre tablas
    g.fillStyle = 'rgba(44,24,11,0.55)';
    g.fillRect(0, y, S, 3);
    g.fillStyle = 'rgba(255,226,190,0.06)';
    g.fillRect(0, y + 3, S, 2);

    // clavos
    for (const nx of [36, S - 36]) {
      g.fillStyle = 'rgba(48,50,52,0.7)';
      g.beginPath();
      g.arc(nx, y + S / planks / 2, 2.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(230,236,240,0.25)';
      g.beginPath();
      g.arc(nx - 0.6, y + S / planks / 2 - 0.6, 0.8, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

/* --------------------------------------------------------------- metal */
function drawMetal() {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(131);
  g.fillStyle = '#b6bec6';
  g.fillRect(0, 0, S, S);

  for (let i = 0; i < 1400; i++) {
    const a = 0.03 + rand() * 0.11;
    g.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(58,68,78,${a})`;
    g.fillRect(0, rand() * S, S, 0.5 + rand() * 1.3);
  }
  for (let i = 0; i < 30; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.04 + rand() * 0.1})`;
    g.lineWidth = 0.5 + rand();
    const y = rand() * S;
    g.beginPath();
    g.moveTo(rand() * S, y);
    g.lineTo(rand() * S, y + (rand() - 0.5) * 1.5);
    g.stroke();
  }
  // arañazos
  for (let i = 0; i < 16; i++) {
    g.strokeStyle = `rgba(70,78,86,${0.1 + rand() * 0.15})`;
    g.lineWidth = 0.5;
    const x = rand() * S;
    const y = rand() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 8 + rand() * 30, y + (rand() - 0.5) * 4);
    g.stroke();
  }
  return c;
}

/* --------------------------------------------------------------- peligro */
function drawHazard() {
  const W = 256;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#f0b429';
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(-64, 0);
  g.rotate(-0.5);
  for (let i = -2; i < 9; i++) {
    g.fillStyle = '#171a1f';
    g.fillRect(i * 64, -60, 30, 300);
  }
  g.restore();

  const rand = rng(171);
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(${30 + rand() * 40 | 0},${30 + rand() * 30 | 0},${24 + rand() * 20 | 0},${0.04 + rand() * 0.12})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 4, 1 + rand() * 2);
  }
  return c;
}

/* --------------------------------------------------------------- asfalto */
function drawAsphalt() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(151);
  g.fillStyle = '#494d50';
  g.fillRect(0, 0, S, S);

  for (let i = 0; i < 9000; i++) {
    const t = 0.5 + rand() * 0.8;
    g.fillStyle = `rgba(${Math.round(112 * t)},${Math.round(114 * t)},${Math.round(117 * t)},0.72)`;
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 2.4, 1 + rand() * 2.4);
  }
  // grietas finas
  for (let i = 0; i < 7; i++) {
    let x = rand() * S;
    let y = rand() * S;
    g.strokeStyle = `rgba(28,30,32,${0.25 + rand() * 0.25})`;
    g.lineWidth = 0.7 + rand() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += (rand() - 0.5) * 30;
      y += (rand() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

/* --------------------------------------------------------------- ladrillo */
function drawBrick() {
  const S = 512;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const rand = rng(191);
  g.fillStyle = '#b8ac97';
  g.fillRect(0, 0, S, S);

  const rows = 8;
  const cols = 4;
  const bw = S / cols;
  const bh = S / rows;
  const gap = 4;

  const tones = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0.8 + rand() * 0.34),
  );

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2);
    for (let col = -1; col <= cols; col++) {
      const ci = ((col % cols) + cols) % cols;
      const x = col * bw + offset;
      const y = r * bh;
      const tone = tones[r][ci];
      const rr = 150 * tone;
      const gg = 76 * tone;
      const bb = 58 * tone;

      const grd = g.createLinearGradient(x, y, x, y + bh);
      grd.addColorStop(0, `rgb(${rr * 1.06 | 0},${gg * 1.04 | 0},${bb * 1.02 | 0})`);
      grd.addColorStop(1, `rgb(${rr * 0.82 | 0},${gg * 0.8 | 0},${bb * 0.8 | 0})`);
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x + gap / 2, y + gap / 2, bw - gap, bh - gap, 1.5);
      g.fill();

      // grano y desconchones
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(${60 + rand() * 60 | 0},${30 + rand() * 30 | 0},${20 + rand() * 20 | 0},${0.05 + rand() * 0.12})`;
        g.fillRect(x + gap + rand() * (bw - gap * 2), y + gap + rand() * (bh - gap * 2), 1 + rand() * 3, 1 + rand() * 2);
      }
      g.fillStyle = 'rgba(255,240,220,0.08)';
      g.fillRect(x + gap / 2, y + gap / 2, bw - gap, 1.5);
    }
  }
  return c;
}

export function buildTextures(renderer) {
  ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const roofC = drawRoofTiles();
  const kawaraC = drawKawara();
  const stuccoC = drawStucco();
  const stoneC = drawStone();
  const grassC = drawGrass();
  const gravelC = drawGravel();
  const cellsC = drawPanel();
  const woodC = drawWood();
  const metalC = drawMetal();
  const hazardC = drawHazard();
  const asphaltC = drawAsphalt();
  const brickC = drawBrick();
  const dustC = drawDust();

  return {
    roof: texture(roofC),
    kawara: texture(kawaraC),
    stucco: texture(stuccoC),
    stone: texture(stoneC),
    grass: texture(grassC),
    gravel: texture(gravelC),
    cells: texture(cellsC),
    wood: texture(woodC),
    metal: texture(metalC),
    hazard: texture(hazardC),
    asphalt: texture(asphaltC),
    brick: texture(brickC),
    dust: texture(dustC),
    normal: {
      roof: normalTexture(normalFrom(roofC, 2.6)),
      kawara: normalTexture(normalFrom(kawaraC, 2.2)),
      stucco: normalTexture(normalFrom(stuccoC, 0.5)),
      stone: normalTexture(normalFrom(stoneC, 2.2)),
      grass: normalTexture(normalFrom(grassC, 0.8)),
      gravel: normalTexture(normalFrom(gravelC, 1.8)),
      wood: normalTexture(normalFrom(woodC, 1.2)),
      metal: normalTexture(normalFrom(metalC, 0.5)),
      asphalt: normalTexture(normalFrom(asphaltC, 1.2)),
      brick: normalTexture(normalFrom(brickC, 2.0)),
    },
  };
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
