import * as THREE from 'three';

/**
 * Dimensiones del mundo en metros. La casa tiene cubierta a dos aguas con el
 * faldón sur (el que ve el jugador) inclinado ~29°, que es lo habitual en una
 * vivienda mediterránea y permite instalar en coplanar.
 */
export const HOUSE = {
  width: 12,
  depth: 8,
  eaveY: 3.0,
  rise: 2.2,
  plinth: 0.35,
};

export const ROOF = (() => {
  const halfDepth = HOUSE.depth / 2;
  const angle = Math.atan2(HOUSE.rise, halfDepth);
  const slopeLength = Math.hypot(HOUSE.rise, halfDepth);
  const normal = new THREE.Vector3(0, halfDepth, HOUSE.rise).normalize();
  const upSlope = new THREE.Vector3(0, HOUSE.rise, -halfDepth).normalize();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), upSlope, normal),
  );
  return {
    halfDepth,
    angle,
    deg: THREE.MathUtils.radToDeg(angle),
    slopeLength,
    normal,
    upSlope,
    quaternion,
    overhangX: 0.35,
    ridgeY: HOUSE.eaveY + HOUSE.rise,
  };
})();

/** Punto del faldón sur: x lateral, d distancia desde el alero medida sobre el faldón. */
export function roofPoint(x, d, target = new THREE.Vector3()) {
  const cos = Math.cos(ROOF.angle);
  const sin = Math.sin(ROOF.angle);
  return target.set(x, HOUSE.eaveY + d * sin, ROOF.halfDepth - d * cos);
}

export function roofYAt(z) {
  return HOUSE.eaveY + (ROOF.halfDepth - z) * Math.tan(ROOF.angle);
}

export const PANEL = {
  width: 1.75,
  height: 1.05,
  thickness: 0.045,
  watts: 450,
  weightKg: 21.5,
  cells: '10 × 6',
};

export const GRID = {
  cols: 5,
  rows: 3,
  colStep: 1.78,
  rowStep: 1.11,
  firstRowD: 1.0,
  centerX: 0,
  /** Altura del marco sobre la teja (guías + grapas). */
  raise: 0.105,
};

export const SLOT_TOTAL = GRID.cols * GRID.rows;

export const ENERGY = {
  yieldPerKwp: 1350,
  pricePerKwh: 0.16,
  co2PerKwh: 0.158,
  minPanels: 8,
};

export const SITE = {
  start: { x: 0.4, z: 10.8 },
  platform: { x0: -3.7, x1: 3.7, z0: 3.98, z1: 6.45, y: 3.0 },
  scaffoldX: 3.7,
  bench: { x: 5.35, z: 7.55, rotY: -0.42 },
  ladder: { x: -4.45, z: 6.05 },
  rack: { x: 5.15, z: 3.15 },
  treeShade: { x: -8.6, y: 7.05, z: 5.55 },
  chimney: { x: 2.7, z: 1.18, w: 0.78 },
  pond: { x: -11, z: 9.5 },
};

export const SUN_DIR = new THREE.Vector3(-0.52, 0.71, 0.47).normalize();

export const COLORS = {
  skyTop: 0x2f6ca6,
  skyHorizon: 0xdfe9ee,
  sun: 0xfff1d0,
  terracotta: 0xb95833,
  stucco: 0xe9e1d2,
  stone: 0xb7ad9b,
  wood: 0x8a5b34,
  aluminium: 0xb9c2c9,
  panelGlass: 0x0d1d2c,
  navy: 0x14263a,
  green: 0x46d99b,
  hazard: 0xffc247,
};
