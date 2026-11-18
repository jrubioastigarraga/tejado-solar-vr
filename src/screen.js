import * as THREE from 'three';

/** Crea una pantalla/panel con textura de canvas redibujable (para HUD y carteles). */
export function makeScreen(width, height, { px = 1024, py = 512, transparent = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = py;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent,
    toneMapped: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 3;

  const draw = (fn) => {
    ctx.clearRect(0, 0, px, py);
    fn(ctx, px, py);
    texture.needsUpdate = true;
  };

  return { mesh, canvas, ctx, texture, material, draw };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function fitText(ctx, text, maxWidth, size, weight = 700, family = 'Inter, "Segoe UI", Arial, sans-serif') {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > 10);
  return s;
}

export function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
