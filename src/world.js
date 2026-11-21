import * as THREE from 'three';
import {
  HOUSE,
  ROOF,
  SITE,
  SUN_DIR,
  roofPoint,
  roofYAt,
} from './config.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cloneRepeat, makeLabelTexture } from './textures.js';
import { makeScreen } from './screen.js';
import { mergeStatic } from './optimize.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m4 = new THREE.Matrix4();

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Caja con bordes suaves para los objetos de superficie lisa. */
function roundedBox(w, h, d, mat, x = 0, y = 0, z = 0, r = 0.035) {
  const radius = Math.min(r, Math.min(w, h, d) / 2 - 0.001);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function tube(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Cielo atmosférico del addon oficial de Three.js (modelo de Preetham).
 * Incluye sol, dispersión y nubes procedurales animadas en un solo draw call,
 * así que sustituye al shader de degradado y a las nubes por sprites.
 */
function makeSky(pagoda = false) {
  const sky = new Sky();
  sky.name = 'cielo';
  sky.scale.setScalar(1000);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  const u = sky.material.uniforms;
  u.turbidity.value = pagoda ? 4 : 3.2;
  u.rayleigh.value = pagoda ? 1.6 : 1.15;
  u.mieCoefficient.value = pagoda ? 0.006 : 0.005;
  u.mieDirectionalG.value = 0.8;
  u.cloudCoverage.value = pagoda ? 0.42 : 0.5;
  u.cloudDensity.value = 0.55;
  u.cloudSpeed.value = 0.000022;
  u.sunPosition.value.copy(SUN_DIR);
  return sky;
}

const _leafNoise = new ImprovedNoise();
let _leafGeo = null;

/** Geometría de hoja deformada con ruido: una sola para todos los árboles. */
function leafGeometry() {
  if (_leafGeo) return _leafGeo;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const d = 1 + _leafNoise.noise(x * 2.1 + 3, y * 2.1 + 7, z * 2.1 + 11) * 0.17;
    pos.setXYZ(i, x * d, y * d, z * d);
  }
  geo.computeVertexNormals();
  _leafGeo = geo;
  return geo;
}

function makeTree({ x, z, scale = 1, seed = 1, big = false, palette = null }) {
  const group = new THREE.Group();
  const rand = (() => {
    let a = seed * 9871;
    return () => {
      a = (a * 16807) % 2147483647;
      return a / 2147483647;
    };
  })();

  const trunkH = (big ? 4.9 : 3.1) * scale;
  const trunkMat = new THREE.MeshStandardMaterial({
    color: palette ? 0x4a3328 : 0x5a4632,
    roughness: 0.95,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.3 * scale, trunkH, 9),
    trunkMat,
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // ramas inclinadas: el tronco deja de ser un simple palo
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2;
    const len = (big ? 2.0 : 1.15) * scale * (0.8 + rand() * 0.45);
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016 * scale, 0.055 * scale, len, 6),
      trunkMat,
    );
    branch.position.set(
      Math.cos(a) * len * 0.3,
      trunkH * (0.6 + rand() * 0.2),
      Math.sin(a) * len * 0.3,
    );
    branch.rotation.z = Math.cos(a) * 0.85;
    branch.rotation.x = -Math.sin(a) * 0.85;
    branch.castShadow = true;
    group.add(branch);
  }

  // Los cinco primeros grupos son los que proyectan sombra de juego (sin cambios).
  const blobs = [];
  if (big) {
    blobs.push({ x: 0, y: 7.05, z: 0, r: 2.35, shade: true });
    blobs.push({ x: -1.5, y: 6.15, z: 0.5, r: 1.75, shade: true });
    blobs.push({ x: 1.35, y: 6.3, z: -0.4, r: 1.65, shade: true });
    blobs.push({ x: 0.15, y: 5.25, z: 0.9, r: 1.5, shade: true });
    blobs.push({ x: 0.6, y: 8.0, z: 0.2, r: 1.45, shade: true });
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const rr = (0.8 + rand() * 1.3) * scale;
      blobs.push({
        x: Math.cos(a) * rr,
        y: (5.4 + rand() * 2.7) * scale,
        z: Math.sin(a) * rr,
        r: (0.65 + rand() * 0.5) * scale,
      });
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      const rr = (0.35 + rand() * 0.95) * scale;
      blobs.push({
        x: Math.cos(a) * rr,
        y: (3.0 + rand() * 1.9) * scale,
        z: Math.sin(a) * rr,
        r: (0.6 + rand() * 0.55) * scale,
      });
    }
  }

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    flatShading: true,
  });
  const foliage = new THREE.InstancedMesh(leafGeometry(), leafMat, blobs.length);
  const baseColors = palette || [0x4c7d3c, 0x5d8f45, 0x3f6b35];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const shadeSpheres = [];
  blobs.forEach((b, i) => {
    v.set(b.x, b.y, b.z);
    e.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6);
    q.setFromEuler(e);
    s.set(b.r * (0.9 + rand() * 0.2), b.r * (0.78 + rand() * 0.28), b.r * (0.9 + rand() * 0.2));
    m.compose(v, q, s);
    foliage.setMatrixAt(i, m);
    const c = new THREE.Color(baseColors[i % baseColors.length]);
    c.offsetHSL((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06);
    foliage.setColorAt(i, c);
    if (b.shade) {
      shadeSpheres.push({ center: new THREE.Vector3(x + b.x, b.y, z + b.z), radius: b.r });
    }
  });
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  group.add(foliage);

  // flores en los cerezos: una instancia más por árbol, sin coste extra por flor
  if (palette) {
    const count = 34;
    const blossoms = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      count,
    );
    for (let i = 0; i < count; i++) {
      const b = blobs[i % blobs.length];
      v.set(b.x + (rand() - 0.5) * b.r * 1.7, b.y + (rand() - 0.5) * b.r * 1.7, b.z + (rand() - 0.5) * b.r * 1.7);
      q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
      s.setScalar(0.6 + rand() * 0.9);
      m.compose(v, q, s);
      blossoms.setMatrixAt(i, m);
      blossoms.setColorAt(i, new THREE.Color(rand() > 0.45 ? 0xffe6f0 : 0xffffff));
    }
    group.add(blossoms);
  }

  group.position.set(x, 0, z);
  group.userData.sway = rand() * Math.PI * 2;
  return { group, shadeSpheres };
}

function makeFenceSegment(x1, z1, x2, z2, mat, postMat) {
  const group = new THREE.Group();
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const n = Math.max(2, Math.round(len / 2.2));
  const yaw = Math.atan2(dx, dz);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    group.add(box(0.11, 1.25, 0.11, postMat, x1 + dx * t, 0.625, z1 + dz * t));
  }
  for (const y of [0.45, 0.95]) {
    const rail = box(0.07, 0.13, len, mat, x1 + dx / 2, y, z1 + dz / 2);
    rail.rotation.y = yaw;
    group.add(rail);
  }
  return group;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const rand = (() => {
    let s = 77;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  for (let i = 0; i < 20; i++) {
    const x = 24 + rand() * 208;
    const y = 40 + rand() * 52;
    const r = 16 + rand() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWaterfallTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(220,245,255,0.95)');
  grd.addColorStop(0.65, 'rgba(185,228,246,0.6)');
  grd.addColorStop(1, 'rgba(185,228,246,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 256);
  const rand = (() => {
    let s = 191;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${0.12 + rand() * 0.4})`;
    g.fillRect(rand() * 62, rand() * 40, 0.8 + rand() * 2.2, 120 + rand() * 130);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeTorii() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xb33528, roughness: 0.62 });
  const black = new THREE.MeshStandardMaterial({ color: 0x211f1d, roughness: 0.72 });
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.4, 12), red);
    pillar.position.set(sx * 2.0, 2.2, 0);
    pillar.castShadow = true;
    g.add(pillar);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.24, 12), black);
    cap.position.set(sx * 2.0, 4.46, 0);
    g.add(cap);
  }
  g.add(box(5.6, 0.3, 0.34, red, 0, 4.08, 0));
  g.add(box(4.7, 0.22, 0.28, red, 0, 3.4, 0));
  g.add(box(6.0, 0.22, 0.42, black, 0, 4.36, 0));
  g.add(box(0.52, 0.62, 0.12, black, 0, 3.76, 0.17));
  return g;
}

function makeStoneLantern() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9b9489, roughness: 0.96 });
  const light = new THREE.MeshStandardMaterial({
    color: 0xffe3ae,
    emissive: 0xffb457,
    emissiveIntensity: 1.3,
    roughness: 0.6,
  });
  g.add(box(0.62, 0.12, 0.62, stone, 0, 0.06, 0));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 10), stone);
  shaft.position.y = 0.57;
  shaft.castShadow = true;
  g.add(shaft);
  g.add(box(0.46, 0.32, 0.46, light, 0, 1.18, 0));
  g.add(box(0.6, 0.1, 0.6, stone, 0, 1.39, 0));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.34, 4), stone);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 1.6;
  cap.castShadow = true;
  g.add(cap);
  g.add(box(0.16, 0.16, 0.16, stone, 0, 1.84, 0));
  return g;
}

function makeBamboo(seed = 1, count = 7) {
  const g = new THREE.Group();
  const rand = (() => {
    let s = seed * 7919;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x6f9b45, roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x7fae52,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < count; i++) {
    const h = 3.8 + rand() * 3.2;
    const x = (rand() - 0.5) * 1.6;
    const z = (rand() - 0.5) * 1.6;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 7), stalkMat);
    stalk.position.set(x, h / 2, z);
    stalk.rotation.z = (rand() - 0.5) * 0.08;
    stalk.castShadow = true;
    g.add(stalk);
    for (let k = 0; k < 5; k++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.11), leafMat);
      leaf.position.set(x + (rand() - 0.5) * 0.7, h * (0.55 + rand() * 0.4), z + (rand() - 0.5) * 0.7);
      leaf.rotation.set(rand() * 0.8 - 0.4, rand() * Math.PI, rand() * 0.6);
      g.add(leaf);
    }
  }
  return g;
}

export function createWorld({ scene, renderer, textures, house, theme = 'villa' }) {
  const pagoda = theme === 'pagoda';
  const fish = [];
  let petals = null;
  let lakeWaterMat = null;
  const group = new THREE.Group();
  group.name = 'entorno';
  scene.add(group);

  /* ------------------------------------------------------------------ cielo */
  const sky = makeSky(pagoda);
  scene.add(sky);

  const envScene = new THREE.Scene();
  const envSphere = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), sky.material);
  envScene.add(envSphere);
  sky.material.uniforms.showSunDisc.value = 0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  sky.material.uniforms.showSunDisc.value = 1;
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  /* ------------------------------------------------------------------- luz */
  const sun = new THREE.DirectionalLight(0xfff1da, 4.8);
  sun.position.copy(SUN_DIR).multiplyScalar(38);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.025;
  sun.target.position.set(0, 1, 0);
  group.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xd7e7ff, 0x5d6b46, 0.95);
  group.add(hemi);

  const fill = new THREE.DirectionalLight(0xbcd4ee, 0.68);
  fill.position.set(6, 14, -12);
  group.add(fill);

  scene.fog = new THREE.Fog(pagoda ? 0xe6e0e2 : 0xd7e3ea, pagoda ? 60 : 75, pagoda ? 210 : 240);

  /* ---------------------------------------------------------------- terreno */
  if (pagoda) {
    const islandRadius = 24;
    const islandMat = new THREE.MeshStandardMaterial({
      map: cloneRepeat(textures.grass, 30, 30),
      normalMap: cloneRepeat(textures.normal.grass, 30, 30),
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0x8fa86f,
      roughness: 1,
    });
    const islandTop = new THREE.Mesh(new THREE.CircleGeometry(islandRadius, 72), islandMat);
    islandTop.rotation.x = -Math.PI / 2;
    islandTop.receiveShadow = true;
    group.add(islandTop);

    const rockMat = new THREE.MeshStandardMaterial({
      map: cloneRepeat(textures.stone, 5, 2),
      normalMap: cloneRepeat(textures.normal.stone, 5, 2),
      normalScale: new THREE.Vector2(1.2, 1.2),
      color: 0x948b7d,
      roughness: 0.98,
    });
    const deco = new THREE.Group();

    // borde rocoso irregular
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const r = islandRadius - 0.1 + Math.sin(a * 5) * 0.5;
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.7 + Math.random() * 1.1, 0),
        rockMat,
      );
      rock.position.set(Math.cos(a) * r, 0.1 + Math.random() * 0.5, Math.sin(a) * r);
      rock.scale.set(1 + Math.random(), 0.8 + Math.random() * 0.8, 1 + Math.random());
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      deco.add(rock);
    }

    // falda de roca bajo la isla
    const under = new THREE.Mesh(new THREE.ConeGeometry(islandRadius * 0.99, 28, 48, 5), rockMat);
    under.rotation.x = Math.PI;
    under.position.y = -14.04;
    under.castShadow = true;
    under.receiveShadow = true;
    group.add(under);
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(islandRadius * 0.7, 20, 40, 3),
      new THREE.MeshStandardMaterial({
        map: cloneRepeat(textures.stone, 3, 3),
        color: 0x6d655b,
        roughness: 1,
      }),
    );
    core.rotation.x = Math.PI;
    core.position.y = -11.03;
    group.add(core);

    // cascada en el borde
    const fallMat = new THREE.MeshBasicMaterial({
      map: makeWaterfallTexture(),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x6fb9d8,
      transparent: true,
      opacity: 0.6,
      roughness: 0.15,
      metalness: 0.2,
      emissive: 0x123a4a,
      side: THREE.DoubleSide,
    });
    const fallX = 17.4;
    const fallZ = 18.0;
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 22), fallMat);
    fall.position.set(fallX, -10.4, fallZ);
    fall.rotation.y = Math.atan2(fallX, fallZ);
    group.add(fall);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(15.4, 0.03, 15.9);
    group.add(pool);

    // rocas colgantes bajo el borde
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = islandRadius * (0.55 + Math.random() * 0.4);
      const hang = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.9, 0),
        rockMat,
      );
      hang.position.set(Math.cos(a) * r, -1 - Math.random() * 5, Math.sin(a) * r);
      hang.scale.set(1, 0.7 + Math.random() * 0.8, 1);
      hang.rotation.set(Math.random(), Math.random(), Math.random());
      hang.castShadow = true;
      deco.add(hang);
    }

    // mar de nubes y niebla al pie
    const cloudTex = makeCloudTexture();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
      const r = 10 + Math.random() * 26;
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        }),
      );
      sp.position.set(Math.cos(a) * r, -7 - Math.random() * 9, Math.sin(a) * r);
      sp.scale.set(20 + Math.random() * 24, 8 + Math.random() * 10, 1);
      group.add(sp);
    }

    // islas flotantes lejanas
    const farIslandMat = new THREE.MeshStandardMaterial({
      map: cloneRepeat(textures.grass, 5, 5),
      color: 0x83a06a,
      roughness: 1,
    });
    for (const [ix, iy, iz, s] of [
      [-58, -5, -42, 1.1],
      [52, 3, -34, 0.85],
      [36, -11, 48, 1.2],
      [-46, 6, 40, 0.7],
    ]) {
      const isle = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(6 * s, 4.6 * s, 1.1 * s, 20), farIslandMat);
      const rock = new THREE.Mesh(new THREE.ConeGeometry(4.8 * s, 10 * s, 20, 3), rockMat);
      rock.rotation.x = Math.PI;
      rock.position.y = -5.2 * s;
      isle.add(top, rock);
      isle.position.set(ix, iy, iz);
      deco.add(isle);
    }

    // puerta torii, faroles y bambú
    const torii = makeTorii();
    torii.position.set(0, 0, 13.2);
    deco.add(torii);

    for (const [lx, lz] of [[-5.9, 8.4], [6.7, 9.6], [-2.7, 12.2]]) {
      const lantern = makeStoneLantern();
      lantern.position.set(lx, 0, lz);
      deco.add(lantern);
    }

    for (const [bx, bz, seed] of [[-10.5, 6.5, 3], [9.2, -6.5, 7], [-8.5, -8.5, 11]]) {
      const bamboo = makeBamboo(seed, 7);
      bamboo.position.set(bx, 0, bz);
      deco.add(bamboo);
    }

    // rocas con musgo
    for (const [rx, rz, rs] of [[-13, 3, 1.3], [12.5, 5, 1.1], [-9, 12, 0.9]]) {
      const boulder = new THREE.Mesh(new THREE.IcosahedronGeometry(rs, 1), rockMat);
      boulder.position.set(rx, rs * 0.45, rz);
      boulder.scale.y = 0.6;
      boulder.rotation.y = rx;
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      deco.add(boulder);
    }

    /* ----------------------------------------------------------- lago */
    const lakeX = 13.2;
    const lakeZ = 3.6;
    const lakeR = 4.2;

    const shore = new THREE.Mesh(
      new THREE.CircleGeometry(lakeR + 0.55, 48),
      new THREE.MeshStandardMaterial({
        map: cloneRepeat(textures.gravel, 4, 4),
        normalMap: cloneRepeat(textures.normal.gravel, 4, 4),
        color: 0xa89f88,
        roughness: 1,
      }),
    );
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(lakeX, 0.006, lakeZ);
    shore.receiveShadow = true;
    deco.add(shore);

    const bed = new THREE.Mesh(
      new THREE.CircleGeometry(lakeR, 48),
      new THREE.MeshStandardMaterial({ color: 0x22332f, roughness: 1 }),
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(lakeX, 0.004, lakeZ);
    deco.add(bed);

    lakeWaterMat = new THREE.MeshStandardMaterial({
      color: 0x3d8fa0,
      transparent: true,
      opacity: 0.52,
      roughness: 0.08,
      metalness: 0.35,
      emissive: 0x0b2a30,
      normalMap: cloneRepeat(textures.normal.water, 4, 4),
      normalScale: new THREE.Vector2(0.42, 0.42),
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lakeWater = new THREE.Mesh(new THREE.CircleGeometry(lakeR, 48), lakeWaterMat);
    lakeWater.rotation.x = -Math.PI / 2;
    lakeWater.position.set(lakeX, 0.05, lakeZ);
    lakeWater.renderOrder = 2;
    group.add(lakeWater);

    // orilla de piedras
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.4, 0),
        rockMat,
      );
      rock.position.set(
        lakeX + Math.cos(a) * (lakeR + 0.35),
        0.12,
        lakeZ + Math.sin(a) * (lakeR + 0.35),
      );
      rock.scale.set(1, 0.7, 1);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      deco.add(rock);
    }

    // nenúfares y juncos
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x477d3d,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (lakeR - 0.9);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.2 + Math.random() * 0.16, 12), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(lakeX + Math.cos(a) * r, 0.062, lakeZ + Math.sin(a) * r);
      deco.add(pad);
    }
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x6f8f45, roughness: 0.9 });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = lakeR + 0.2 + Math.random() * 0.5;
      const h = 0.5 + Math.random() * 0.7;
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, h, 5), reedMat);
      reed.position.set(lakeX + Math.cos(a) * r, h / 2, lakeZ + Math.sin(a) * r);
      reed.rotation.z = (Math.random() - 0.5) * 0.2;
      deco.add(reed);
    }

    // embarcadero
    const pierMat = new THREE.MeshStandardMaterial({
      map: cloneRepeat(textures.wood, 2, 1),
      normalMap: cloneRepeat(textures.normal.wood, 2, 1),
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0x8e6c46,
      roughness: 0.9,
    });
    const pierPostMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 });
    const pier = new THREE.Group();
    pier.add(box(1.1, 0.09, 2.2, pierMat, 0, 0.14, 0));
    for (const px of [-0.45, 0.45]) {
      for (const pz of [-0.9, 0.9]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 7), pierPostMat);
        post.position.set(px, -0.4, pz);
        pier.add(post);
      }
    }
    pier.position.set(lakeX - 3.0, 0.02, lakeZ + 1.2);
    pier.rotation.y = 0.5;
    deco.add(pier);

    // peces koi
    const koiColors = [0xff8a3d, 0xfff0dc, 0xe04a2f, 0xffc247, 0xf5f2ea];
    for (let i = 0; i < 11; i++) {
      const koi = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: koiColors[i % koiColors.length],
        roughness: 0.5,
        emissive: 0x241008,
        emissiveIntensity: 0.25,
      });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat);
      body.scale.set(1.9, 0.75, 1);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 4), mat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.18;
      koi.add(body, tail);
      koi.scale.setScalar(0.75 + Math.random() * 0.5);
      group.add(koi);
      fish.push({
        mesh: koi,
        cx: lakeX,
        cz: lakeZ,
        r: 0.7 + Math.random() * (lakeR - 1.4),
        speed: 0.18 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        dir: Math.random() > 0.5 ? 1 : -1,
        y: 0.008 + Math.random() * 0.025,
      });
    }

    // pétalos de cerezo: caen y giran lentamente sobre la isla
    const petalCount = 170;
    petals = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.15, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0xffc1d6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        toneMapped: false,
      }),
      petalCount,
    );
    petals.name = 'sakura';
    petals.frustumCulled = false;
    petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const petalData = [];
    for (let i = 0; i < petalCount; i++) {
      petalData.push({
        x: (Math.random() - 0.5) * 38,
        y: Math.random() * 15 + 1,
        z: (Math.random() - 0.5) * 38,
        phase: Math.random() * Math.PI * 2,
        speed: 0.45 + Math.random() * 0.7,
        spin: (Math.random() - 0.5) * 2.4,
        scale: 0.7 + Math.random() * 0.8,
      });
    }
    petals.userData.data = petalData;
    group.add(petals);

    group.add(deco);
    mergeStatic(deco);
  } else {
    const grassTex = cloneRepeat(textures.grass, 70, 70);
    const groundMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      normalMap: cloneRepeat(textures.normal.grass, 70, 70),
      normalScale: new THREE.Vector2(0.65, 0.65),
      color: 0x9aa87a,
      roughness: 1,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 72), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    const gravelMat = new THREE.MeshStandardMaterial({
      map: cloneRepeat(textures.gravel, 5, 12),
      normalMap: cloneRepeat(textures.normal.gravel, 5, 12),
      normalScale: new THREE.Vector2(0.9, 0.9),
      color: 0xc9c3b6,
      roughness: 1,
    });
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 10.5), gravelMat);
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(6.6, 0.012, 10.6);
    drive.receiveShadow = true;
    group.add(drive);

    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.2), gravelMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(-0.3, 0.014, 8.9);
    path.receiveShadow = true;
    group.add(path);

    const asphaltMat = new THREE.MeshStandardMaterial({
      map: cloneRepeat(textures.asphalt, 30, 2),
      normalMap: cloneRepeat(textures.normal.asphalt, 30, 2),
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0x777b7e,
      roughness: 0.95,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 5.4), asphaltMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.008, 16.4);
    road.receiveShadow = true;
    group.add(road);

    const curbMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.9 });
    group.add(box(90, 0.16, 0.24, curbMat, 0, 0.08, 13.6));

    // setos y parterres junto a la fachada
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x3f6f37, roughness: 0.95 });
    for (const [hx, hz, hw, hh] of [
      [-5.1, 4.6, 1.6, 0.7],
      [5.0, 4.55, 1.4, 0.65],
      [-5.4, 5.3, 1.0, 0.5],
    ]) {
      const hedge = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hedgeMat);
      hedge.scale.set(hw, hh, hw * 0.7);
      hedge.position.set(hx, hh * 0.8, hz);
      hedge.castShadow = true;
      hedge.receiveShadow = true;
      group.add(hedge);
    }
  }

  /* ------------------------------------------------------------ material de obra */
  const brickMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.brick, 1, 1),
    normalMap: cloneRepeat(textures.normal.brick, 1, 1),
    normalScale: new THREE.Vector2(0.9, 0.9),
    color: 0xd8c6b2,
    roughness: 0.96,
  });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xf2661f, roughness: 0.62 });
  const coneBandMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 });

  function makeCone(x, z, rotY = 0) {
    const cone = new THREE.Group();
    cone.add(box(0.32, 0.035, 0.32, coneMat, 0, 0.018, 0));
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.155, 0.52, 18), coneMat);
    body.position.y = 0.29;
    body.castShadow = true;
    body.receiveShadow = true;
    cone.add(body);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.108, 0.126, 0.085, 18, 1, true),
      coneBandMat,
    );
    band.position.y = 0.31;
    cone.add(band);
    cone.position.set(x, 0, z);
    cone.rotation.y = rotY;
    return cone;
  }
  group.add(makeCone(4.9, 8.1, 0.2), makeCone(5.6, 10.4, -0.3), makeCone(-5.9, 8.4, 0.5));

  // palé de ladrillos junto a la fachada
  const palletMat = new THREE.MeshStandardMaterial({ color: 0x9b7a4e, roughness: 0.9 });
  const brickStack = new THREE.Group();
  brickStack.add(box(0.92, 0.09, 0.62, palletMat, 0, 0.045, 0));
  for (let layer = 0; layer < 4; layer++) {
    for (let i = 0; i < 5; i++) {
      const brick = box(0.19, 0.072, 0.1, brickMat, -0.34 + i * 0.17, 0.13 + layer * 0.078, 0.06);
      brick.rotation.y = (layer % 2) * (Math.PI / 2);
      brickStack.add(brick);
    }
  }
  brickStack.position.set(7.4, 0, 5.6);
  brickStack.rotation.y = 0.28;
  group.add(brickStack);

  /* ----------------------------------------------------------------- árboles */
  const sakura = [0xe89ab0, 0xf3b9c8, 0xd9849b];
  const trees = [];
  const shadeTree = makeTree({
    x: SITE.treeShade.x,
    z: SITE.treeShade.z,
    scale: 1,
    seed: 3,
    big: true,
    palette: pagoda ? sakura : null,
  });
  group.add(shadeTree.group);
  trees.push(shadeTree);

  const otherTrees = pagoda
    ? [
        { x: 13.5, z: 8.5, scale: 1.1, seed: 11 },
        { x: -15.5, z: 11.5, scale: 1.3, seed: 23 },
        { x: 12.5, z: -8.5, scale: 1.0, seed: 37 },
        { x: -14.5, z: -9.5, scale: 1.15, seed: 41 },
      ]
    : [
        { x: 13.5, z: 10.5, scale: 1.25, seed: 11 },
        { x: -15.5, z: 11.5, scale: 1.5, seed: 23 },
        { x: 12.5, z: -8.5, scale: 1.15, seed: 37 },
        { x: -14.5, z: -9.5, scale: 1.3, seed: 41 },
        { x: 17.5, z: 1.5, scale: 0.95, seed: 53 },
        { x: -19, z: 2.5, scale: 1.05, seed: 67 },
      ];
  for (const t of otherTrees) {
    const tree = makeTree({ ...t, palette: pagoda ? sakura : null });
    group.add(tree.group);
    trees.push(tree);
  }

  if (!pagoda) {
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x537f3a,
      roughness: 0.95,
      flatShading: true,
    });
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.25, 1), bushMat);
      b.position.set(-11 + Math.random() * 22, 0.25, 7 + Math.random() * 4);
      if (
        Math.abs(b.position.x - SITE.bench.x) < 2.6 &&
        Math.abs(b.position.z - SITE.bench.z) < 2.2
      )
        continue;
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
    }
  }

  /* ------------------------------------------------------------------ valla */
  if (!pagoda) {
    const fenceMat = new THREE.MeshStandardMaterial({
      map: cloneRepeat(textures.wood, 2, 1),
      normalMap: cloneRepeat(textures.normal.wood, 2, 1),
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0x8e6c46,
      roughness: 0.9,
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6d5335, roughness: 0.95 });
    const fence = new THREE.Group();
    fence.add(makeFenceSegment(-17, 13.2, 17, 13.2, fenceMat, postMat));
    fence.add(makeFenceSegment(-17, 13.2, -17, -11, fenceMat, postMat));
    fence.add(makeFenceSegment(17, 13.2, 17, -11, fenceMat, postMat));
    mergeStatic(fence);
    group.add(fence);
  }

  /* ---------------------------------------------------------- casas lejanas */
  if (!pagoda) {
    const farMat = new THREE.MeshStandardMaterial({ color: 0xded6c6, roughness: 0.9 });
    const farRoofMat = new THREE.MeshStandardMaterial({ color: 0x9c5b41, roughness: 0.9 });
    for (const [fx, fz, fw, fh] of [
      [-32, -18, 9, 4],
      [34, -8, 11, 5],
      [18, -32, 8, 4],
    ]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fw * 0.7), farMat);
      h.position.set(fx, fh / 2, fz);
      group.add(h);
      const r = new THREE.Mesh(new THREE.ConeGeometry(fw * 0.8, fh * 0.7, 4), farRoofMat);
      r.position.set(fx, fh + fh * 0.32, fz);
      r.rotation.y = Math.PI / 4;
      group.add(r);
    }
  }

  /* -------------------------------------------------------- colinas y nubes */
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x78885f, roughness: 1, flatShading: true });
  const randH = (() => {
    let s = 1234;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  if (!pagoda) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      const r = 110 + randH() * 30;
      const geo = new THREE.SphereGeometry(36 + randH() * 26, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      const h = new THREE.Mesh(geo, hillMat);
      h.position.set(Math.sin(a) * r, -2 - randH() * 3, Math.cos(a) * r);
      h.scale.set(1.5, 0.34 + randH() * 0.2, 1.0);
      h.rotation.y = randH() * Math.PI;
      group.add(h);
    }
  }
  /* --------------------------------------------------------------- andamio */
  const scaffold = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.metal, 2, 1),
    normalMap: cloneRepeat(textures.normal.metal, 2, 1),
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0xaeb7bd,
    roughness: 0.42,
    metalness: 0.8,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.wood, 5, 1),
    normalMap: cloneRepeat(textures.normal.wood, 5, 1),
    normalScale: new THREE.Vector2(0.9, 0.9),
    color: 0xa9a083,
    roughness: 0.85,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.hazard, 6, 1),
    color: 0xffffff,
    roughness: 0.7,
  });
  const deckY = SITE.platform.y;

  const deck = box(
    SITE.platform.x1 - SITE.platform.x0,
    0.12,
    SITE.platform.z1 - SITE.platform.z0,
    deckMat,
    (SITE.platform.x0 + SITE.platform.x1) / 2,
    deckY - 0.06,
    (SITE.platform.z0 + SITE.platform.z1) / 2,
  );
  scaffold.add(deck);

  const postXs = [-3.7, -1.85, 0, 1.85, 3.7];
  for (const x of postXs) {
    for (const z of [SITE.platform.z0 + 0.06, SITE.platform.z1 - 0.04]) {
      scaffold.add(tube(0.035, deckY, metal).translateX(x).translateY(deckY / 2).translateZ(z));
    }
  }
  for (const y of [0.9, 1.85, 2.86]) {
    for (const z of [SITE.platform.z0 + 0.06, SITE.platform.z1 - 0.04]) {
      const rail = tube(0.028, 7.4, metal);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, y, z);
      scaffold.add(rail);
    }
    for (const x of [-3.7, 3.7]) {
      const rail = tube(0.028, 2.42, metal);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, y, (SITE.platform.z0 + SITE.platform.z1) / 2);
      scaffold.add(rail);
    }
  }
  // diagonales
  for (const z of [SITE.platform.z0 + 0.06, SITE.platform.z1 - 0.04]) {
    for (const x of [-1.9, 1.9]) {
      const diag = tube(0.016, 3.4, metal);
      diag.rotation.z = 0.72;
      diag.position.set(x, 1.5, z);
      scaffold.add(diag);
    }
  }

  // barandilla trasera y lateral (el frente queda abierto a la cubierta)
  const guardMat = new THREE.MeshStandardMaterial({ color: 0xc3a940, roughness: 0.62, metalness: 0.25 });
  for (const y of [deckY + 0.5, deckY + 1.0]) {
    const back = tube(0.026, 7.4, guardMat);
    back.rotation.z = Math.PI / 2;
    back.position.set(0, y, SITE.platform.z1 - 0.06);
    scaffold.add(back);
    for (const x of [-3.68, 3.68]) {
      const side = tube(0.026, 2.4, guardMat);
      side.rotation.x = Math.PI / 2;
      side.position.set(x, y, (SITE.platform.z0 + SITE.platform.z1) / 2);
      scaffold.add(side);
    }
  }
  for (const x of [-3.68, -1.8, 0, 1.8, 3.68]) {
    scaffold.add(tube(0.024, 1.0, guardMat).translateX(x).translateY(deckY + 0.5).translateZ(SITE.platform.z1 - 0.06));
  }
  const toe = box(7.4, 0.18, 0.03, hazardMat, 0, deckY + 0.09, SITE.platform.z1 - 0.09);
  scaffold.add(toe);
  for (const x of [-3.66, 3.66]) {
    const t2 = box(0.03, 0.18, 2.4, hazardMat, x, deckY + 0.09, (SITE.platform.z0 + SITE.platform.z1) / 2);
    scaffold.add(t2);
  }

  // escalera de acceso
  const ladderX = SITE.ladder.x;
  const ladderZ = SITE.ladder.z;
  const ladderGroup = new THREE.Group();
  for (const dx of [-0.23, 0.23]) {
    const rail = tube(0.032, 3.35, metal);
    rail.position.set(dx, 1.62, 0);
    rail.rotation.x = 0.11;
    ladderGroup.add(rail);
  }
  for (let i = 0; i < 9; i++) {
    const rung = tube(0.022, 0.46, metal);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.3 + i * 0.36, 0.02 + i * 0.04);
    ladderGroup.add(rung);
  }
  ladderGroup.position.set(ladderX, 0, ladderZ);
  scaffold.add(ladderGroup);
  mergeStatic(scaffold);
  group.add(scaffold);

  /* ----------------------------------------------------------- pulsador subir */
  const accessPedestal = new THREE.Group();
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x25313d, roughness: 0.55, metalness: 0.35 });
  const pedestal = roundedBox(0.42, 1.1, 0.26, pedMat, 0, 0.55, 0, 0.045);
  accessPedestal.add(pedestal);
  const accessButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.06, 22),
    new THREE.MeshStandardMaterial({
      color: 0x1f6b45,
      emissive: 0x24c07a,
      emissiveIntensity: 1.1,
      roughness: 0.35,
      metalness: 0.2,
    }),
  );
  accessButton.rotation.x = Math.PI / 2;
  accessButton.position.set(0, 0.92, -0.15);
  accessButton.castShadow = true;
  accessButton.userData.kind = 'button';
  accessPedestal.add(accessButton);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 24), metal);
  ring.position.set(0, 0.92, -0.145);
  accessPedestal.add(ring);

  const accessLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.3),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(
        [
          { text: 'ACCESO A CUBIERTA', size: 38, color: '#ffc247' },
          { text: 'pulsa para subir', size: 28, color: '#dbe8f5' },
        ],
        { bg: 'rgba(8,14,22,0.92)', border: 'rgba(255,194,71,0.6)' },
      ),
      transparent: true,
      toneMapped: false,
    }),
  );
  accessLabel.position.set(0, 1.28, -0.14);
  accessPedestal.add(accessLabel);
  accessPedestal.position.set(ladderX + 0.75, 0, 7.35);
  accessPedestal.rotation.y = -0.25;
  group.add(accessPedestal);

  /* -------------------------------------------------------- pulsador bajar */
  const descendPedestal = new THREE.Group();
  descendPedestal.add(roundedBox(0.3, 0.88, 0.22, pedMat, 0, 0.44, 0, 0.035));
  const descendButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.045, 20),
    new THREE.MeshStandardMaterial({
      color: 0x8e2f28,
      emissive: 0xff5b48,
      emissiveIntensity: 1.0,
      roughness: 0.38,
      metalness: 0.2,
    }),
  );
  descendButton.rotation.x = Math.PI / 2;
  descendButton.position.set(0, 0.74, -0.13);
  descendButton.castShadow = true;
  descendButton.userData.kind = 'button';
  descendPedestal.add(descendButton);
  const descendLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.22),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(
        [
          { text: 'BAJAR', size: 40, color: '#ffb0a0' },
          { text: 'pulsa para bajar', size: 23, color: '#dbe8f5' },
        ],
        { bg: 'rgba(60,16,16,0.92)', border: 'rgba(255,120,100,0.7)' },
      ),
      transparent: true,
      toneMapped: false,
    }),
  );
  descendLabel.position.set(0, 1.03, -0.12);
  descendPedestal.add(descendLabel);
  descendPedestal.position.set(SITE.platform.x0 + 0.7, deckY, SITE.platform.z1 - 0.5);
  group.add(descendPedestal);

  /* ------------------------------------------------------------- mesa de EPI */
  const benchGroup = new THREE.Group();
  const benchTopMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.wood, 3, 1),
    normalMap: cloneRepeat(textures.normal.wood, 3, 1),
    normalScale: new THREE.Vector2(0.8, 0.8),
    color: 0xd6b184,
    roughness: 0.78,
  });
  benchGroup.add(box(2.7, 0.09, 0.92, benchTopMat, 0, 0.94, 0));
  for (const sx of [-1.2, 1.2]) {
    for (const sz of [-0.34, 0.34]) {
      const leg = box(0.08, 0.92, 0.08, metal, sx, 0.46, sz);
      benchGroup.add(leg);
    }
  }
  benchGroup.add(box(2.5, 0.04, 0.7, metal, 0, 0.16, 0));
  benchGroup.add(box(2.35, 0.06, 0.08, benchTopMat, 0, 0.72, -0.4));

  const ppeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.62),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(
        [
          { text: 'EPI OBLIGATORIO', size: 44, color: '#ffc247' },
          { text: 'casco · gafas · guantes · arnés', size: 26, color: '#dce8f4' },
        ],
        { bg: 'rgba(185,64,32,0.94)', border: 'rgba(255,220,160,0.85)' },
      ),
      transparent: true,
      toneMapped: false,
    }),
  );
  ppeSign.position.set(0, 1.72, -0.52);
  benchGroup.add(ppeSign);
  for (const sx of [-0.7, 0.7]) {
    benchGroup.add(box(0.05, 1.3, 0.05, metal, sx, 1.35, -0.5));
  }

  const planTex = makeLabelTexture(
    [
      { text: 'PLAN DE INSTALACIÓN', size: 34, color: '#ffc247' },
      { text: '15 paneles · 450 Wp', size: 30, color: '#eef5ff' },
      { text: 'faldón sur · 29°', size: 30, color: '#eef5ff' },
      { text: 'mínimo 8 para certificar', size: 24, color: '#9fb4c8' },
    ],
    { bg: 'rgba(9,16,26,0.95)', border: 'rgba(120,160,200,0.5)', align: 'left', width: 600, height: 300 },
  );
  const plan = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.31),
    new THREE.MeshBasicMaterial({ map: planTex, transparent: true, toneMapped: false }),
  );
  plan.position.set(-0.55, 1.06, 0.18);
  plan.rotation.x = -0.5;
  benchGroup.add(plan);

  benchGroup.position.set(SITE.bench.x, 0, SITE.bench.z);
  benchGroup.rotation.y = SITE.bench.rotY;
  mergeStatic(benchGroup);
  group.add(benchGroup);

  /* ------------------------------------------------------- máquina de café */
  const coffeeGroup = new THREE.Group();
  const coffeeBodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a323a,
    roughness: 0.48,
    metalness: 0.35,
  });
  const coffeeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xb9c2c9,
    roughness: 0.3,
    metalness: 0.85,
  });
  coffeeGroup.add(roundedBox(0.92, 0.07, 0.62, benchTopMat, 0, 0.79, 0, 0.02));
  for (const sx of [-0.38, 0.38]) {
    for (const sz of [-0.23, 0.23]) {
      coffeeGroup.add(box(0.06, 0.78, 0.06, metal, sx, 0.39, sz));
    }
  }
  coffeeGroup.add(roundedBox(0.6, 0.66, 0.46, coffeeBodyMat, 0, 1.16, 0, 0.06));
  coffeeGroup.add(
    box(0.5, 0.3, 0.03, new THREE.MeshStandardMaterial({ color: 0x0d1620, roughness: 0.25 }), 0, 1.22, 0.24),
  );
  coffeeGroup.add(box(0.34, 0.02, 0.18, coffeeTrimMat, 0, 0.87, 0.18));
  coffeeGroup.add(box(0.3, 0.02, 0.24, coffeeTrimMat, 0, 0.87, 0.33));
  coffeeGroup.add(box(0.06, 0.1, 0.06, coffeeTrimMat, 0, 0.99, 0.16));
  const coffeeButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.04, 20),
    new THREE.MeshStandardMaterial({
      color: 0x1f6b45,
      emissive: 0x24c07a,
      emissiveIntensity: 1.0,
      roughness: 0.4,
    }),
  );
  coffeeButton.rotation.x = Math.PI / 2;
  coffeeButton.position.set(0.17, 1.22, 0.26);
  coffeeButton.castShadow = true;
  coffeeButton.userData.kind = 'button';
  coffeeGroup.add(coffeeButton);

  const coffeeCup = new THREE.Group();
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xf7f3ec, roughness: 0.42 });
  coffeeCup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.1, 16), cupMat));
  const coffeeSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.049, 16),
    new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.35 }),
  );
  coffeeSurface.rotation.x = -Math.PI / 2;
  coffeeSurface.position.y = 0.052;
  coffeeCup.add(coffeeSurface);
  const cupHandle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 12, Math.PI * 1.3), cupMat);
  cupHandle.position.x = 0.06;
  cupHandle.rotation.y = Math.PI / 2;
  coffeeCup.add(cupHandle);
  coffeeCup.position.set(-0.02, 0.95, 0.34);
  coffeeCup.visible = false;
  coffeeGroup.add(coffeeCup);

  const coffeeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.3),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(
        [
          { text: 'MÁQUINA DE CAFÉ', size: 32, color: '#ffc247' },
          { text: 'pulsa para pedir', size: 24, color: '#dce8f4' },
        ],
        { bg: 'rgba(8,14,22,0.92)', border: 'rgba(255,194,71,0.6)' },
      ),
      transparent: true,
      toneMapped: false,
    }),
  );
  coffeeSign.position.set(0, 1.66, 0);
  coffeeGroup.add(coffeeSign);
  coffeeGroup.position.set(7.15, 0, 7.1);
  coffeeGroup.rotation.y = -0.7;
  group.add(coffeeGroup);

  /* --------------------------------------------------------- cartel de obra */
  const boardPos = new THREE.Vector3(-3.42, 4.16, 5.28);
  const boardGroup = new THREE.Group();
  boardGroup.position.copy(boardPos);
  boardGroup.rotation.y = Math.PI / 2;
  boardGroup.add(box(1.9, 1.06, 0.06, new THREE.MeshStandardMaterial({ color: 0x17232f, roughness: 0.6 }), 0, 0, -0.04));
  const boardScreen = makeScreen(1.78, 0.94, { px: 1280, py: 660 });
  boardScreen.mesh.position.z = 0.005;
  boardGroup.add(boardScreen.mesh);
  for (const sx of [-0.72, 0.72]) {
    const post = tube(0.03, 1.16, metal);
    post.position.set(sx, -1.16, -0.05);
    boardGroup.add(post);
  }
  mergeStatic(boardGroup);
  group.add(boardGroup);

  /* ------------------------------------------------------ inversor / control */
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(3.18, deckY, SITE.platform.z1 - 0.2);
  consoleGroup.rotation.y = 0;
  const consoleBody = box(0.72, 0.62, 0.3, new THREE.MeshStandardMaterial({ color: 0x2c3945, roughness: 0.5, metalness: 0.25 }), 0, 0.98, 0);
  consoleGroup.add(consoleBody);
  consoleGroup.add(box(0.62, 0.92, 0.1, metal, 0, 0.52, 0));
  const lcd = makeScreen(0.52, 0.24, { px: 640, py: 300 });
  lcd.mesh.position.set(0, 1.09, -0.156);
  lcd.mesh.rotation.y = Math.PI;
  consoleGroup.add(lcd.mesh);
  const finishButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.15, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x1e7a4d,
      emissive: 0x39e59b,
      emissiveIntensity: 0.8,
      roughness: 0.35,
    }),
  );
  finishButton.position.set(0, 0.66, -0.2);
  finishButton.castShadow = true;
  finishButton.userData.kind = 'button';
  consoleGroup.add(finishButton);
  const finishLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.2),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture('CERTIFICAR', {
        width: 512,
        height: 128,
        bg: 'rgba(8,14,22,0.9)',
        border: 'rgba(70,217,155,0.6)',
        color: '#c8ffe9',
        radius: 40,
      }),
      transparent: true,
      toneMapped: false,
    }),
  );
  finishLabel.position.set(0, 0.45, -0.195);
  consoleGroup.add(finishLabel);
  group.add(consoleGroup);

  /* -------------------------------------------------------- stock de paneles */
  const rackGroup = new THREE.Group();
  const stackCenter = roofPoint(SITE.rack.x, 1.22);
  const pallet = box(1.2, 0.06, 1.88, deckMat, 0, 0, 0);
  pallet.position.copy(stackCenter).addScaledVector(ROOF.normal, 0.02);
  pallet.quaternion.copy(ROOF.quaternion);
  rackGroup.add(pallet);
  for (const dd of [-0.55, 0, 0.55]) {
    const beam = box(1.16, 0.07, 0.09, benchTopMat, 0, 0, 0);
    beam.position.copy(roofPoint(SITE.rack.x, 1.22 + dd)).addScaledVector(ROOF.normal, 0.03);
    beam.quaternion.copy(ROOF.quaternion);
    rackGroup.add(beam);
  }
  const rackSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.24),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(['STOCK · 450 Wp'], {
        width: 512,
        height: 200,
        bg: 'rgba(9,16,26,0.88)',
        border: 'rgba(255,194,71,0.55)',
        color: '#ffc247',
        radius: 30,
      }),
      transparent: true,
      toneMapped: false,
    }),
  );
  rackSign.position.set(SITE.rack.x + 0.05, roofYAt(3.9) + 0.62, 3.9);
  rackGroup.add(rackSign);
  rackGroup.add(tube(0.025, 0.62, metal).translateX(SITE.rack.x + 0.05).translateY(roofYAt(3.9) + 0.31).translateZ(3.9));
  mergeStatic(rackGroup);
  group.add(rackGroup);

  /* ---------------------------------------------------- cepillo de limpieza */
  const brushGroup = new THREE.Group();
  const brushWoodMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.85 });
  const bristleMat = new THREE.MeshStandardMaterial({ color: 0xd8c48f, roughness: 1 });
  const brushHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.42, 10), brushWoodMat);
  brushHandle.rotation.z = Math.PI / 2;
  brushHandle.position.x = -0.16;
  brushHandle.castShadow = true;
  brushGroup.add(brushHandle);
  brushGroup.add(box(0.26, 0.05, 0.11, brushWoodMat, 0.16, 0, 0));
  for (let i = 0; i < 5; i++) {
    brushGroup.add(box(0.2, 0.05, 0.014, bristleMat, 0.16, -0.045, -0.042 + i * 0.021));
  }
  brushGroup.position.set(2.25, deckY + 0.075, 5.72);
  brushGroup.rotation.y = -0.45;
  brushGroup.userData.basePos = brushGroup.position.clone();
  brushGroup.userData.baseQuat = brushGroup.quaternion.clone();
  brushGroup.userData.state = 'free';
  brushGroup.userData.kind = 'brush';
  group.add(brushGroup);

  /* --------------------------------------------------------------- helpers */
  const shadeSpheres = shadeTree.shadeSpheres;
  const raycaster = new THREE.Raycaster();
  const shadeFactorCache = new Map();

  function shadeAt(point, normal) {
    const key = `${point.x.toFixed(2)}|${point.y.toFixed(2)}|${point.z.toFixed(2)}`;
    if (shadeFactorCache.has(key)) return shadeFactorCache.get(key);
    const origin = _v.copy(point).addScaledVector(normal, 0.14);
    let factor = 1;

    // chimenea (sombra dura)
    raycaster.set(origin, SUN_DIR);
    raycaster.far = 40;
    if (raycaster.intersectObject(house.chimney, true).length) factor = 0.35;

    // copa del árbol del jardín (sombra parcial)
    if (factor === 1) {
      for (const s of shadeSpheres) {
        _v2.copy(origin).sub(s.center);
        const b = _v2.dot(SUN_DIR);
        const c = _v2.lengthSq() - s.radius * s.radius;
        if (c <= 0) {
          factor = 0.5;
          break;
        }
        const disc = b * b - c;
        if (disc > 0 && -b - Math.sqrt(disc) > 0) {
          factor = 0.55;
          break;
        }
      }
    }
    shadeFactorCache.set(key, factor);
    return factor;
  }

  function update(dt, elapsed) {
    // nubes procedurales del addon Sky y ondas del lago
    sky.material.uniforms.time.value = elapsed;
    if (lakeWaterMat) {
      lakeWaterMat.normalMap.offset.x += dt * 0.018;
      lakeWaterMat.normalMap.offset.y += dt * 0.011;
    }
    for (const t of trees) {
      const sway = t.group.userData.sway || 0;
      t.group.rotation.z = Math.sin(elapsed * 0.7 + sway) * 0.006;
      t.group.rotation.x = Math.cos(elapsed * 0.5 + sway) * 0.004;
    }

    // koi nadando en círculos bajo la superficie
    for (const f of fish) {
      const a = f.phase + elapsed * f.speed * f.dir;
      f.mesh.position.set(
        f.cx + Math.cos(a) * f.r,
        f.y + Math.sin(elapsed * 2.2 + f.phase) * 0.02,
        f.cz + Math.sin(a) * f.r,
      );
      f.mesh.rotation.y = Math.atan2(-Math.cos(a) * f.dir, -Math.sin(a) * f.dir);
    }

    // pétalos de sakura
    if (petals) {
      const data = petals.userData.data;
      for (let i = 0; i < data.length; i++) {
        const p = data[i];
        p.y -= p.speed * dt;
        if (p.y < 0.08) {
          p.y = 13 + Math.random() * 4;
          p.x = (Math.random() - 0.5) * 38;
          p.z = (Math.random() - 0.5) * 38;
        }
        _v.set(
          p.x + Math.sin(elapsed * 1.3 + p.phase) * 0.38,
          p.y,
          p.z + Math.cos(elapsed * 0.9 + p.phase) * 0.26,
        );
        _q.setFromEuler(_e.set(p.phase + elapsed * p.spin, elapsed * p.spin * 0.6, p.phase));
        _s.setScalar(p.scale);
        _m4.compose(_v, _q, _s);
        petals.setMatrixAt(i, _m4);
      }
      petals.instanceMatrix.needsUpdate = true;
    }
  }

  function setLcd(lines, accent = '#46d99b', footer = null) {
    lcd.draw((ctx, w, h) => {
      ctx.fillStyle = '#061019';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(70,217,155,0.35)';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#8fe8c0';
      ctx.font = '600 22px Inter, Arial, sans-serif';
      ctx.fillText('INVERSOR · PV', 28, 46);
      ctx.fillStyle = accent;
      ctx.font = '800 66px Inter, Arial, sans-serif';
      ctx.fillText(lines[0] || '0,00 kWp', 28, 122);
      ctx.fillStyle = '#bfe0d1';
      ctx.font = '500 24px Inter, Arial, sans-serif';
      ctx.fillText(lines[1] || 'sin producción', 28, 168);
      ctx.fillStyle = footer ? '#8fe8c0' : '#4f7a68';
      ctx.font = '600 18px Inter, Arial, sans-serif';
      ctx.fillText(footer || 'strings · 1', 28, 216);
      ctx.fillStyle = '#46d99b';
      ctx.beginPath();
      ctx.arc(w - 42, 40, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  setLcd(['0,00 kWp', 'esperando paneles'], '#6f8d7f');

  return {
    group,
    sky,
    sun,
    trees,
    fish,
    shadeSpheres,
    shadeAt,
    update,
    accessButton,
    accessPedestal,
    descendButton,
    descendPedestal,
    coffeeButton,
    coffeeCup,
    coffeeGroup,
    finishButton,
    finishConsole: consoleGroup,
    deckY,
    consolePos: new THREE.Vector3(3.18, deckY, SITE.platform.z1 - 0.2),
    brush: brushGroup,
    bench: { group: benchGroup, topY: 0.985, rotY: SITE.bench.rotY, x: SITE.bench.x, z: SITE.bench.z },
    board: { group: boardGroup, screen: boardScreen, position: boardPos },
    rack: { group: rackGroup, baseY: roofYAt(3.9) },
    safetyAnchor: new THREE.Vector3(0, roofYAt(0.62) + 0.4, 0.62),
    setLcd,
  };
}
