import * as THREE from 'three';
import { HOUSE, ROOF, SITE, COLORS, roofPoint, roofYAt } from './config.js';
import { cloneRepeat } from './textures.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function plane(w, h, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function frameRect(w, h, bar, depth, mat) {
  const g = new THREE.Group();
  g.add(box(w, bar, depth, mat, 0, h / 2 - bar / 2, 0));
  g.add(box(w, bar, depth, mat, 0, -h / 2 + bar / 2, 0));
  g.add(box(bar, h - bar * 2, depth, mat, -w / 2 + bar / 2, 0, 0));
  g.add(box(bar, h - bar * 2, depth, mat, w / 2 - bar / 2, 0, 0));
  return g;
}

export function createHouse(textures) {
  const group = new THREE.Group();
  group.name = 'casa';

  /* ------------------------------------------------------------ materiales */
  const stuccoMap = cloneRepeat(textures.stucco, 6, 1.5);
  const stuccoMat = new THREE.MeshStandardMaterial({
    map: stuccoMap,
    normalMap: cloneRepeat(textures.normal.stucco, 6, 1.5),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: cloneRepeat(textures.roughness.stucco, 6, 1.5),
    color: 0xf3ece0,
    roughness: 0.92,
    metalness: 0,
  });
  const gableMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.stucco, 2.6, 0.9),
    normalMap: cloneRepeat(textures.normal.stucco, 2.6, 0.9),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: cloneRepeat(textures.roughness.stucco, 2.6, 0.9),
    color: 0xefe7da,
    roughness: 0.94,
    side: THREE.DoubleSide,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.stone, 8, 0.7),
    normalMap: cloneRepeat(textures.normal.stone, 8, 0.7),
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: cloneRepeat(textures.roughness.stone, 8, 0.7),
    color: 0xcfc6b6,
    roughness: 0.95,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.roof, 11, 3.2),
    normalMap: cloneRepeat(textures.normal.roof, 11, 3.2),
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: cloneRepeat(textures.roughness.roof, 11, 3.2),
    color: 0xefe0d6,
    roughness: 0.9,
    metalness: 0.02,
  });
  const roofMatNorth = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.roof, 11, 3.2),
    normalMap: cloneRepeat(textures.normal.roof, 11, 3.2),
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: cloneRepeat(textures.roughness.roof, 11, 3.2),
    color: 0xd9c4b8,
    roughness: 0.92,
  });
  const ridgeMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.roof, 12, 0.5),
    normalMap: cloneRepeat(textures.normal.roof, 12, 0.5),
    normalScale: new THREE.Vector2(1, 1),
    roughnessMap: cloneRepeat(textures.roughness.roof, 12, 0.5),
    color: 0xa8573a,
    roughness: 0.85,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.6 });
  const woodMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.wood, 1.2, 1.2),
    normalMap: cloneRepeat(textures.normal.wood, 1.2, 1.2),
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: cloneRepeat(textures.roughness.wood, 1.2, 1.2),
    color: 0x7c5330,
    roughness: 0.8,
  });
  const shutterMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.wood, 1, 1.6),
    normalMap: cloneRepeat(textures.normal.wood, 1, 1.6),
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: cloneRepeat(textures.roughness.wood, 1, 1.6),
    color: 0x78917c,
    roughness: 0.8,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.metal, 2, 1),
    normalMap: cloneRepeat(textures.normal.metal, 2, 1),
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0x9aa4ad,
    roughness: 0.38,
    metalness: 0.85,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xb4bec8,
    roughness: 0.32,
    metalness: 0.9,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.7 });
  const revealMat = new THREE.MeshStandardMaterial({ color: 0x2f4353, roughness: 0.9 });
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 1 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x6d8a99,
    metalness: 0.35,
    roughness: 0.05,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.55,
  });
  const chimneyMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.brick, 1.1, 2.1),
    normalMap: cloneRepeat(textures.normal.brick, 1.1, 2.1),
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: cloneRepeat(textures.roughness.brick, 1.1, 2.1),
    color: 0xd9c3ae,
    roughness: 0.96,
  });
  const terracottaMat = new THREE.MeshStandardMaterial({
    color: 0xa8532f,
    roughness: 0.85,
  });

  /* ---------------------------------------------------------------- muros */
  const plinth = box(HOUSE.width + 0.5, HOUSE.plinth + 0.12, HOUSE.depth + 0.5, stoneMat, 0, (HOUSE.plinth + 0.12) / 2, 0);
  group.add(plinth);

  const wallH = HOUSE.eaveY - HOUSE.plinth;
  const walls = box(HOUSE.width, wallH, HOUSE.depth, stuccoMat, 0, HOUSE.plinth + wallH / 2, 0);
  group.add(walls);

  // oclusión ambiental en el encuentro muro-zócalo (sombra de contacto)
  const aoMat = new THREE.MeshBasicMaterial({
    color: 0x1a1208,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  group.add(box(HOUSE.width + 0.02, 0.16, HOUSE.depth + 0.02, aoMat, 0, HOUSE.plinth + 0.08, 0));

  // hastiales (triángulos de las fachadas este/oeste)
  const shape = new THREE.Shape();
  shape.moveTo(-ROOF.halfDepth, 0);
  shape.lineTo(ROOF.halfDepth, 0);
  shape.lineTo(0, HOUSE.rise);
  shape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  gableGeo.rotateY(-Math.PI / 2);
  const gableR = new THREE.Mesh(gableGeo, gableMat);
  gableR.position.set(HOUSE.width / 2 - 0.15, HOUSE.eaveY, 0);
  gableR.castShadow = true;
  gableR.receiveShadow = true;
  const gableL = gableR.clone();
  gableL.position.x = -HOUSE.width / 2 + 0.15;
  gableL.scale.x = -1;
  group.add(gableR, gableL);

  /* ---------------------------------------------------------------- faldón */
  function makeRoofPlane(sign) {
    const up = new THREE.Vector3(0, HOUSE.rise, -sign * ROOF.halfDepth).normalize();
    const nrm = new THREE.Vector3(0, ROOF.halfDepth, sign * HOUSE.rise).normalize();
    const bx = new THREE.Vector3(sign > 0 ? 1 : -1, 0, 0);
    const quat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(bx, up, nrm),
    );
    const length = ROOF.slopeLength + (sign > 0 ? 0.06 : 0.24);
    const width = HOUSE.width + ROOF.overhangX * 2;
    const geo = new THREE.PlaneGeometry(width, length);
    const mat = (sign > 0 ? roofMat : roofMatNorth).clone();
    mat.map = cloneRepeat(textures.roof, 11, 3.2);
    mat.normalMap = cloneRepeat(textures.normal.roof, 11, 3.2);
    if (sign < 0) mat.color = new THREE.Color(0xb08b77);
    const mesh = new THREE.Mesh(geo, mat);
    const dCenter = length / 2 + (sign > 0 ? 0 : 0.1);
    if (sign > 0) {
      mesh.position.copy(roofPoint(0, dCenter));
      mesh.quaternion.copy(quat);
    } else {
      mesh.position.set(0, HOUSE.eaveY + dCenter * Math.sin(ROOF.angle), -(ROOF.halfDepth - 0.1 - dCenter * Math.cos(ROOF.angle)));
      mesh.quaternion.copy(quat);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  const roofSouth = makeRoofPlane(1);
  const roofNorth = makeRoofPlane(-1);
  group.add(roofSouth, roofNorth);

  // caballete
  const ridge = box(HOUSE.width + ROOF.overhangX * 2 + 0.1, 0.14, 0.5, ridgeMat, 0, ROOF.ridgeY + 0.06, 0);
  group.add(ridge);

  // aleros y remates de hastial
  const fascia = box(HOUSE.width + 0.8, 0.2, 0.07, trimMat, 0, HOUSE.eaveY - 0.08, HOUSE.depth / 2 + 0.09);
  group.add(fascia);
  const fasciaN = fascia.clone();
  fasciaN.position.z = -HOUSE.depth / 2 - 0.09;
  group.add(fasciaN);

  for (const sx of [-1, 1]) {
    const barge = box(0.1, ROOF.slopeLength + 0.12, 0.18, trimMat, 0, 0, 0);
    barge.quaternion.copy(ROOF.quaternion);
    barge.position.copy(
      roofPoint(sx * (HOUSE.width / 2 + ROOF.overhangX), ROOF.slopeLength / 2 + 0.03),
    );
    barge.position.addScaledVector(ROOF.normal, 0.09);
    group.add(barge);
  }

  /* ------------------------------------------------------------- canalones */
  const gutterMat = new THREE.MeshStandardMaterial({ color: 0x5b6469, roughness: 0.45, metalness: 0.75 });
  for (const s of [1, -1]) {
    const gutter = box(HOUSE.width + 0.6, 0.1, 0.16, gutterMat, 0, HOUSE.eaveY - 0.13, s * (HOUSE.depth / 2 + 0.11));
    group.add(gutter);
    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 2.92, 10), gutterMat);
      pipe.position.set(sx * 5.9, 1.46, s * (HOUSE.depth / 2 + 0.16));
      pipe.castShadow = true;
      group.add(pipe);
      group.add(box(0.16, 0.1, 0.16, gutterMat, sx * 5.9, 2.88, s * (HOUSE.depth / 2 + 0.13)));
    }
  }

  // testeras de teja: rompen el borde recto del alero
  const tileEndMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.roof, 1, 1),
    color: 0xc4784f,
    roughness: 0.88,
  });
  for (const s of [1, -1]) {
    for (let x = -HOUSE.width / 2 - 0.1; x <= HOUSE.width / 2 + 0.1; x += 0.34) {
      const end = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        tileEndMat,
      );
      end.rotation.x = (Math.PI / 2) * s;
      end.position.set(x, HOUSE.eaveY - 0.05, s * (HOUSE.depth / 2 + 0.17));
      group.add(end);
    }
  }

  /* --------------------------------------------------------------- ventanas */
  function addWindow(x, y, z, w, h, facing = 1) {
    const g = new THREE.Group();
    const depth = 0.14;
    g.add(box(w + 0.18, h + 0.18, depth, revealMat, 0, 0, 0.04));
    // cortinas interiores
    for (const s of [-1, 1]) {
      g.add(box(0.24, h - 0.06, 0.02, curtainMat, s * (w / 2 - 0.2), 0, 0.09));
    }
    g.add(plane(w, h, glassMat, 0, 0, 0.12));
    const fr = frameRect(w + 0.14, h + 0.14, 0.075, 0.13, trimMat);
    fr.position.z = 0.14;
    g.add(fr);
    g.add(box(0.05, h, 0.09, trimMat, 0, 0, 0.14));
    g.add(box(w + 0.34, 0.09, 0.26, trimMat, 0, -h / 2 - 0.11, 0.13));
    // contraventanas
    for (const s of [-1, 1]) {
      const sh = box(w / 2 - 0.02, h + 0.02, 0.045, shutterMat, s * (w / 2 + w / 4 + 0.09), 0, 0.2);
      g.add(sh);
      for (let i = 0; i < 6; i++) {
        const slat = box(w / 2 - 0.1, 0.018, 0.012, shutterMat, s * (w / 2 + w / 4 + 0.09), -h / 2 + 0.12 + (i * (h - 0.2)) / 5, 0.226);
        g.add(slat);
      }
    }
    if (facing < 0) g.rotation.y = Math.PI;
    g.position.set(x, y, z);
    return g;
  }

  group.add(addWindow(-3.35, 1.95, HOUSE.depth / 2 + 0.02, 1.44, 1.22));
  group.add(addWindow(3.35, 1.95, HOUSE.depth / 2 + 0.02, 1.44, 1.22));
  group.add(addWindow(-2.2, 1.9, -HOUSE.depth / 2 - 0.02, 1.2, 1.1, -1));
  group.add(addWindow(2.6, 1.9, -HOUSE.depth / 2 - 0.02, 1.2, 1.1, -1));

  // jardinera bajo la ventana este
  const planter = box(1.5, 0.26, 0.32, trimMat, 3.35, 1.16, HOUSE.depth / 2 + 0.28);
  group.add(planter);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + Math.random() * 0.08, 0), leafMat);
    leaf.position.set(2.85 + Math.random() * 1.0, 1.35 + Math.random() * 0.14, HOUSE.depth / 2 + 0.3);
    leaf.castShadow = true;
    group.add(leaf);
  }

  /* ----------------------------------------------------------------- puerta */
  const doorX = -0.35;
  group.add(box(1.16, 2.26, 0.16, trimMat, doorX, 1.44, HOUSE.depth / 2 + 0.03));
  const doorPanel = box(1.0, 2.1, 0.07, woodMat, doorX, 1.4, HOUSE.depth / 2 + 0.13);
  group.add(doorPanel);
  for (const yy of [0.72, 1.4, 2.08]) {
    group.add(box(0.7, 0.03, 0.02, darkMat, doorX, yy, HOUSE.depth / 2 + 0.17));
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), metalMat);
  knob.position.set(doorX + 0.38, 1.05, HOUSE.depth / 2 + 0.2);
  knob.castShadow = true;
  group.add(knob);

  // escalón de entrada
  group.add(box(1.7, 0.16, 0.6, stoneMat, doorX, 0.2, HOUSE.depth / 2 + 0.3));

  // farol
  group.add(box(0.16, 0.4, 0.16, darkMat, doorX + 1.05, 2.25, HOUSE.depth / 2 + 0.12));
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.16, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd27a, emissiveIntensity: 1.4 }),
  );
  bulb.position.set(doorX + 1.05, 2.22, HOUSE.depth / 2 + 0.21);
  group.add(bulb);

  /* --------------------------------------------------------------- chimenea */
  const chimBase = roofYAt(SITE.chimney.z);
  const chimneyGroup = new THREE.Group();
  const chimney = box(SITE.chimney.w, 2.3, SITE.chimney.w, chimneyMat, 0, 1.0, 0);
  chimneyGroup.add(chimney);
  chimneyGroup.add(box(SITE.chimney.w + 0.24, 0.12, SITE.chimney.w + 0.24, stoneMat, 0, 2.16, 0));
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.5, 12, 1, true), terracottaMat);
  pot.position.set(-0.14, 2.44, 0);
  pot.castShadow = true;
  chimneyGroup.add(pot);
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.62, 10), metalMat);
  flue.position.set(0.17, 2.5, 0.05);
  flue.castShadow = true;
  chimneyGroup.add(flue);
  chimneyGroup.position.set(SITE.chimney.x, chimBase - 0.25, SITE.chimney.z);
  group.add(chimneyGroup);

  /* ------------------------------------------------------------ instalación */
  const rails = new THREE.Group();
  rails.name = 'guias';
  const railXs = [-4.435, -2.67, -0.89, 0.89, 2.67, 4.435];
  const railD0 = 0.42;
  const railD1 = 3.78;
  const railLen = railD1 - railD0;
  for (const x of railXs) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, railLen, 0.05), railMat);
    rail.quaternion.copy(ROOF.quaternion);
    rail.position.copy(roofPoint(x, (railD0 + railD1) / 2));
    rail.position.addScaledVector(ROOF.normal, 0.062);
    rail.castShadow = true;
    rail.receiveShadow = true;
    rails.add(rail);
    for (let d = railD0 + 0.2; d < railD1; d += 0.92) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.1), railMat);
      foot.quaternion.copy(ROOF.quaternion);
      foot.position.copy(roofPoint(x, d));
      foot.position.addScaledVector(ROOF.normal, 0.02);
      foot.castShadow = true;
      rails.add(foot);
    }
  }
  group.add(rails);

  // anclaje de línea de vida en cumbrera
  const anchor = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 8), railMat);
  post.position.y = 0.17;
  post.castShadow = true;
  anchor.add(post);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 20), railMat);
  ring.position.y = 0.36;
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  anchor.add(ring);
  anchor.position.set(0, roofYAt(0.62) + 0.02, 0.62);
  group.add(anchor);

  // inversor exterior + conducto
  const inv = new THREE.Group();
  inv.add(box(0.62, 0.8, 0.2, new THREE.MeshStandardMaterial({ color: 0xdfe4e8, roughness: 0.5 }), 0, 0, 0));
  inv.add(box(0.5, 0.24, 0.03, new THREE.MeshStandardMaterial({ color: 0x1b2c3a, roughness: 0.3 }), 0, 0.18, 0.11));
  const led = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 12),
    new THREE.MeshBasicMaterial({ color: 0x46ff9f }),
  );
  led.position.set(0.16, -0.18, 0.112);
  inv.add(led);
  inv.position.set(3.05, 1.55, HOUSE.depth / 2 + 0.14);
  group.add(inv);
  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 3.0, 8), gutterMat);
  conduit.position.set(3.05, 3.0, HOUSE.depth / 2 + 0.1);
  group.add(conduit);
  const conduitBend = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.2, 8), gutterMat);
  conduitBend.rotation.z = Math.PI / 2.6;
  conduitBend.position.set(3.35, 4.35, HOUSE.depth / 2 + 0.1);
  group.add(conduitBend);

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return {
    group,
    roofSouth,
    roofNorth,
    chimney: chimneyGroup,
    chimneyWidth: SITE.chimney.w,
    anchor,
    rails,
    materials: { stuccoMat, roofMat, glassMat, trimMat, metalMat, railMat },
  };
}
