import * as THREE from 'three';
import {
  HOUSE,
  ROOF,
  SITE,
  SUN_DIR,
  roofPoint,
  roofYAt,
} from './config.js';
import { cloneRepeat, makeLabelTexture } from './textures.js';
import { makeScreen } from './screen.js';
import { mergeStatic } from './optimize.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
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

function makeSky() {
  const geo = new THREE.SphereGeometry(420, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      topColor: { value: new THREE.Color('#3f7db4') },
      midColor: { value: new THREE.Color('#a9c8dd') },
      horizonColor: { value: new THREE.Color('#e6eef2') },
      sunColor: { value: new THREE.Color('#fff3d8') },
      sunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      uniform vec3 topColor, midColor, horizonColor, sunColor, sunDir;
      void main() {
        vec3 d = normalize(vWorld);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
        col = mix(col, topColor, smoothstep(0.2, 0.95, h));
        float sd = max(dot(d, sunDir), 0.0);
        col += sunColor * pow(sd, 2200.0) * 2.4;
        col += sunColor * pow(sd, 40.0) * 0.16;
        col += sunColor * pow(sd, 5.0) * 0.05;
        col = mix(col, horizonColor * 0.98, smoothstep(0.1, -0.08, d.y));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, mat };
}

function makeTree({ x, z, scale = 1, seed = 1, big = false }) {
  const group = new THREE.Group();
  const rand = (() => {
    let a = seed * 9871;
    return () => {
      a = (a * 16807) % 2147483647;
      return a / 2147483647;
    };
  })();

  const trunkH = (big ? 4.9 : 3.1) * scale;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17 * scale, 0.3 * scale, trunkH, 9),
    trunkMat,
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x4c7d3c, roughness: 0.92, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x5d8f45, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x3f6b35, roughness: 0.94, flatShading: true }),
  ];

  const blobs = [];
  if (big) {
    blobs.push({ x: 0, y: 7.05, z: 0, r: 2.35, shade: true });
    blobs.push({ x: -1.5, y: 6.15, z: 0.5, r: 1.75, shade: true });
    blobs.push({ x: 1.35, y: 6.3, z: -0.4, r: 1.65, shade: true });
    blobs.push({ x: 0.15, y: 5.25, z: 0.9, r: 1.5, shade: true });
    blobs.push({ x: 0.6, y: 8.0, z: 0.2, r: 1.45, shade: true });
  } else {
    for (let i = 0; i < 4; i++) {
      blobs.push({
        x: (rand() - 0.5) * 1.8 * scale,
        y: (3.1 + rand() * 1.5) * scale,
        z: (rand() - 0.5) * 1.8 * scale,
        r: (1.0 + rand() * 0.55) * scale,
      });
    }
  }

  const shadeSpheres = [];
  blobs.forEach((b, i) => {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 1), leafMats[i % 3]);
    leaf.position.set(b.x, b.y, b.z);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    group.add(leaf);
    if (b.shade) {
      shadeSpheres.push({
        center: new THREE.Vector3(x + b.x, b.y, z + b.z),
        radius: b.r,
      });
    }
  });

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

export function createWorld({ scene, renderer, textures, house }) {
  const group = new THREE.Group();
  group.name = 'entorno';
  scene.add(group);

  /* ------------------------------------------------------------------ cielo */
  const sky = makeSky();
  scene.add(sky.mesh);

  const envScene = new THREE.Scene();
  const envSphere = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), sky.mat);
  envScene.add(envSphere);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  /* ------------------------------------------------------------------- luz */
  const sun = new THREE.DirectionalLight(0xfff1da, 3.2);
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

  const hemi = new THREE.HemisphereLight(0xd7e7ff, 0x5d6b46, 0.65);
  group.add(hemi);

  const fill = new THREE.DirectionalLight(0xbcd4ee, 0.45);
  fill.position.set(6, 14, -12);
  group.add(fill);

  scene.fog = new THREE.Fog(0xd7e3ea, 75, 240);

  /* ---------------------------------------------------------------- terreno */
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
  const trees = [];
  const shadeTree = makeTree({ x: SITE.treeShade.x, z: SITE.treeShade.z, scale: 1, seed: 3, big: true });
  group.add(shadeTree.group);
  trees.push(shadeTree);

  const otherTrees = [
    { x: 13.5, z: 10.5, scale: 1.25, seed: 11 },
    { x: -15.5, z: 11.5, scale: 1.5, seed: 23 },
    { x: 12.5, z: -8.5, scale: 1.15, seed: 37 },
    { x: -14.5, z: -9.5, scale: 1.3, seed: 41 },
    { x: 17.5, z: 1.5, scale: 0.95, seed: 53 },
    { x: -19, z: 2.5, scale: 1.05, seed: 67 },
  ];
  for (const t of otherTrees) {
    const tree = makeTree(t);
    group.add(tree.group);
    trees.push(tree);
  }

  const bushMat = new THREE.MeshStandardMaterial({ color: 0x537f3a, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.25, 1), bushMat);
    b.position.set(-11 + Math.random() * 22, 0.25, 7 + Math.random() * 4);
    if (Math.abs(b.position.x - SITE.bench.x) < 2.6 && Math.abs(b.position.z - SITE.bench.z) < 2.2) continue;
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
  }

  /* ------------------------------------------------------------------ valla */
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

  /* ---------------------------------------------------------- casas lejanas */
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

  /* -------------------------------------------------------- colinas y nubes */
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x78885f, roughness: 1, flatShading: true });
  const randH = (() => {
    let s = 1234;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
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
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 128;
  const cg = cloudCanvas.getContext('2d');
  const cr = (() => {
    let s = 99;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  for (let i = 0; i < 16; i++) {
    const x = 30 + cr() * 196;
    const y = 45 + cr() * 50;
    const rad = 16 + cr() * 34;
    const grd = cg.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = grd;
    cg.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 7; i++) {
    const a = i * 1.35 + 0.5;
    const r = 150 + randH() * 120;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    sp.position.set(Math.sin(a) * r, 52 + randH() * 38, Math.cos(a) * r);
    sp.scale.set(80 + randH() * 60, 30 + randH() * 20, 1);
    group.add(sp);
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
  const pedestal = box(0.42, 1.1, 0.26, pedMat, 0, 0.55, 0);
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
    for (const t of trees) {
      const sway = t.group.userData.sway || 0;
      t.group.rotation.z = Math.sin(elapsed * 0.7 + sway) * 0.006;
      t.group.rotation.x = Math.cos(elapsed * 0.5 + sway) * 0.004;
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
    shadeSpheres,
    shadeAt,
    update,
    accessButton,
    accessPedestal,
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
