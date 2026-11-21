import * as THREE from 'three';
import { HOUSE, ROOF, SITE, roofPoint, roofYAt } from './config.js';
import { cloneRepeat } from './textures.js';

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

/**
 * Pagoda japonesa de tres cuerpos sobre la misma huella y cubierta transitable
 * que la villa, para que la jugabilidad (EPI, guías, paneles, cableado) sea
 * idéntica en ambas escenas. Los paneles van sobre la cubierta del cuerpo bajo.
 */
export function createPagoda(textures) {
  const group = new THREE.Group();
  group.name = 'pagoda';

  /* ------------------------------------------------------------ materiales */
  const plasterMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.stucco, 5, 1.4),
    normalMap: cloneRepeat(textures.normal.stucco, 5, 1.4),
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: 0xf4ead8,
    roughness: 0.95,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.wood, 1.4, 1.2),
    normalMap: cloneRepeat(textures.normal.wood, 1.4, 1.2),
    normalScale: new THREE.Vector2(0.8, 0.8),
    color: 0x5b3c28,
    roughness: 0.8,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.wood, 1, 2),
    normalMap: cloneRepeat(textures.normal.wood, 1, 2),
    normalScale: new THREE.Vector2(0.7, 0.7),
    color: 0x38251a,
    roughness: 0.85,
  });
  const lacquerMat = new THREE.MeshStandardMaterial({
    color: 0xa93227,
    roughness: 0.52,
    metalness: 0.08,
  });
  const kawaraMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.kawara, 11, 3.4),
    normalMap: cloneRepeat(textures.normal.kawara, 11, 3.4),
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: 0xd2dde5,
    roughness: 0.68,
    metalness: 0.14,
  });
  const ridgeMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.kawara, 12, 0.6),
    normalMap: cloneRepeat(textures.normal.kawara, 12, 0.6),
    color: 0x9fadb8,
    roughness: 0.6,
    metalness: 0.2,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.stone, 6, 0.8),
    normalMap: cloneRepeat(textures.normal.stone, 6, 0.8),
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: 0xb9b3a6,
    roughness: 0.95,
  });
  const shojiMat = new THREE.MeshStandardMaterial({
    color: 0xf7efdd,
    roughness: 0.95,
    emissive: 0x3a2c18,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.metal, 2, 1),
    normalMap: cloneRepeat(textures.normal.metal, 2, 1),
    normalScale: new THREE.Vector2(0.3, 0.3),
    color: 0x7f8a92,
    roughness: 0.4,
    metalness: 0.8,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x8d979f,
    roughness: 0.34,
    metalness: 0.85,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a93a,
    metalness: 0.8,
    roughness: 0.34,
  });
  // remates y aleros: teja vidriada oscura con reflejo metálico
  const eaveMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.kawara, 14, 0.6),
    normalMap: cloneRepeat(textures.normal.kawara, 14, 0.6),
    color: 0x76848f,
    roughness: 0.55,
    metalness: 0.22,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc7a24c,
    metalness: 0.85,
    roughness: 0.3,
  });

  /* --------------------------------------------------------------- basamento */
  const plinth = box(
    HOUSE.width + 0.7,
    HOUSE.plinth + 0.14,
    HOUSE.depth + 0.7,
    stoneMat,
    0,
    (HOUSE.plinth + 0.14) / 2,
    0,
  );
  group.add(plinth);

  // engawa: pasarela de madera alrededor de la fachada sur
  const engawaZ = HOUSE.depth / 2 + 0.72;
  group.add(box(HOUSE.width + 0.4, 0.16, 1.5, woodMat, 0, 0.42, engawaZ));
  for (const sx of [-5.4, -2.7, 0, 2.7, 5.4]) {
    group.add(box(0.12, 0.42, 0.12, darkWoodMat, sx, 0.21, engawaZ + 0.6));
  }
  group.add(box(HOUSE.width + 0.4, 0.1, 0.12, darkWoodMat, 0, 0.34, engawaZ + 0.68));

  /* ------------------------------------------------------------------ muros */
  const wallH = HOUSE.eaveY - HOUSE.plinth;
  group.add(box(HOUSE.width, wallH, HOUSE.depth, plasterMat, 0, HOUSE.plinth + wallH / 2, 0));

  // pilares y vigas de madera
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(
        box(0.22, wallH + 0.1, 0.22, lacquerMat, sx * (HOUSE.width / 2 - 0.02), HOUSE.plinth + wallH / 2, sz * (HOUSE.depth / 2 - 0.02)),
      );
    }
  }
  for (const y of [HOUSE.plinth + 0.06, HOUSE.eaveY - 0.16]) {
    for (const z of [-HOUSE.depth / 2 - 0.02, HOUSE.depth / 2 + 0.02]) {
      group.add(box(HOUSE.width + 0.06, 0.16, 0.14, lacquerMat, 0, y, z));
    }
    for (const x of [-HOUSE.width / 2 - 0.02, HOUSE.width / 2 + 0.02]) {
      group.add(box(0.14, 0.16, HOUSE.depth + 0.06, lacquerMat, x, y, 0));
    }
  }
  // friso decorativo bajo el alero
  for (const z of [-HOUSE.depth / 2 - 0.03, HOUSE.depth / 2 + 0.03]) {
    group.add(box(HOUSE.width + 0.12, 0.07, 0.1, goldMat, 0, HOUSE.eaveY - 0.36, z));
  }

  /* -------------------------------------------------- cubierta a cuatro aguas
     Sustituye los hastiales occidentales: el tejado de la pagoda cierra también
     por los lados y levanta las esquinas. La cara sur sigue siendo el plano
     jugable exacto donde se anclan las guías y los paneles. */
  const eaveOverhang = ROOF.overhangX + 0.45;
  const hipX = HOUSE.width / 2 + eaveOverhang;
  const hipZ = HOUSE.depth / 2 + 0.42;
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-hipZ, HOUSE.eaveY - 0.04);
    shape.lineTo(hipZ, HOUSE.eaveY - 0.04);
    shape.lineTo(0, ROOF.ridgeY + 0.02);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateY((sx * Math.PI) / 2);
    const mat = kawaraMat.clone();
    mat.side = THREE.DoubleSide;
    mat.map = cloneRepeat(textures.kawara, 3, 3);
    mat.normalMap = cloneRepeat(textures.normal.kawara, 3, 3);
    const hip = new THREE.Mesh(geo, mat);
    hip.position.x = sx * hipX;
    hip.castShadow = true;
    hip.receiveShadow = true;
    group.add(hip);

    // ménsulas de madera (tokyō) bajo el alero lateral
    for (let z = -hipZ + 0.3; z < hipZ; z += 0.85) {
      group.add(box(0.34, 0.2, 0.16, darkWoodMat, sx * (hipX - 0.16), HOUSE.eaveY - 0.16, z));
      group.add(box(0.42, 0.07, 0.24, lacquerMat, sx * (hipX - 0.18), HOUSE.eaveY - 0.28, z));
    }
  }

  // aleros curvos: cada esquina se levanta, rasgo inconfundible de la pagoda
  function curvedEave(axis, sign) {
    const pts = [];
    const half = axis === 'x' ? hipX : hipZ;
    const fixed = axis === 'x' ? sign * hipZ : sign * hipX;
    for (let i = 0; i <= 18; i++) {
      const u = -half + (2 * half * i) / 18;
      const edge = Math.abs(u) / half;
      const lift = 0.34 * Math.pow(edge, 2.6);
      const out = 0.14 * edge;
      if (axis === 'x') {
        pts.push(new THREE.Vector3(u, HOUSE.eaveY - 0.05 + lift, fixed + sign * out));
      } else {
        pts.push(new THREE.Vector3(fixed + sign * out, HOUSE.eaveY - 0.05 + lift, u));
      }
    }
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.075, 6, false),
      eaveMat,
    );
    mesh.castShadow = true;
    group.add(mesh);
  }
  curvedEave('x', 1);
  curvedEave('x', -1);
  curvedEave('z', 1);
  curvedEave('z', -1);

  /* ----------------------------------------------------------------- faldón */
  function makeRoofPlane(sign) {
    const up = new THREE.Vector3(0, HOUSE.rise, -sign * ROOF.halfDepth).normalize();
    const nrm = new THREE.Vector3(0, ROOF.halfDepth, sign * HOUSE.rise).normalize();
    const bx = new THREE.Vector3(sign > 0 ? 1 : -1, 0, 0);
    const quat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(bx, up, nrm),
    );
    const length = ROOF.slopeLength + 0.5;
    const width = HOUSE.width + eaveOverhang * 2;
    const geo = new THREE.PlaneGeometry(width, length);
    const mat = kawaraMat.clone();
    mat.map = cloneRepeat(textures.kawara, 11, 3.4);
    mat.normalMap = cloneRepeat(textures.normal.kawara, 11, 3.4);
    if (sign < 0) mat.color = new THREE.Color(0xb6c2ca);
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

  // cumbrera y remates de latón (shibi) en ambos extremos
  const ridgeLen = HOUSE.width + eaveOverhang * 2 + 0.3;
  group.add(box(ridgeLen, 0.22, 0.5, ridgeMat, 0, ROOF.ridgeY + 0.1, 0));
  for (const sx of [-1, 1]) {
    const x = sx * (ridgeLen / 2 + 0.06);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), brassMat);
    ball.position.set(x, ROOF.ridgeY + 0.2, 0);
    group.add(ball);
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.66, 6), brassMat);
    finial.position.set(x, ROOF.ridgeY + 0.56, 0);
    finial.rotation.z = -sx * 0.2;
    finial.castShadow = true;
    group.add(finial);
  }

  // cuernos de esquina: pequeños aleros que se rizan hacia arriba
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * (hipX - 0.18), HOUSE.eaveY + 0.25, sz * (hipZ - 0.18)),
        new THREE.Vector3(sx * hipX, HOUSE.eaveY + 0.33, sz * hipZ),
        new THREE.Vector3(sx * (hipX + 0.22), HOUSE.eaveY + 0.62, sz * (hipZ + 0.22)),
      ]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.07, 6, false), eaveMat);
      horn.castShadow = true;
      group.add(horn);
    }
  }

  /* ------------------------------------------------------------- ventanas */
  function addShoji(x, y, z, w, h, facing = 1) {
    const g = new THREE.Group();
    g.add(box(w + 0.18, h + 0.18, 0.08, lacquerMat, 0, 0, 0.02));
    g.add(plane(w, h, shojiMat, 0, 0, 0.07));
    for (let i = 1; i < 4; i++) {
      g.add(box(0.028, h, 0.02, lacquerMat, -w / 2 + (i * w) / 4, 0, 0.085));
    }
    for (let i = 1; i < 3; i++) {
      g.add(box(w, 0.028, 0.02, lacquerMat, 0, -h / 2 + (i * h) / 3, 0.085));
    }
    if (facing < 0) g.rotation.y = Math.PI;
    g.position.set(x, y, z);
    return g;
  }

  group.add(addShoji(-3.35, 1.95, HOUSE.depth / 2 + 0.02, 1.6, 1.3));
  group.add(addShoji(3.35, 1.95, HOUSE.depth / 2 + 0.02, 1.6, 1.3));
  group.add(addShoji(-2.2, 1.9, -HOUSE.depth / 2 - 0.02, 1.3, 1.15, -1));
  group.add(addShoji(2.6, 1.9, -HOUSE.depth / 2 - 0.02, 1.3, 1.15, -1));
  group.add(addShoji(-HOUSE.width / 2 - 0.02, 1.95, 0, 1.1, 1.4, 1));

  /* ------------------------------------------------------------------ puerta */
  const doorX = -0.35;
  group.add(box(1.9, 2.34, 0.08, lacquerMat, doorX, 1.42, HOUSE.depth / 2 + 0.04));
  for (const s of [-1, 1]) {
    const panel = addShoji(doorX + s * 0.42, 1.4, HOUSE.depth / 2 + 0.14, 0.78, 2.06, 1);
    group.add(panel);
  }
  group.add(box(0.08, 2.2, 0.14, lacquerMat, doorX, 1.4, HOUSE.depth / 2 + 0.2));
  // escalones de piedra
  group.add(box(2.3, 0.18, 0.6, stoneMat, doorX, 0.2, HOUSE.depth / 2 + 0.55));
  group.add(box(2.7, 0.14, 0.4, stoneMat, doorX, 0.08, HOUSE.depth / 2 + 0.95));

  /* ------------------------------------------- cuerpos superiores de la pagoda
     Nacen de la cumbrera de la cubierta solar: ya no flotan sobre una casa.
     La planta baja es el primer cuerpo (su tejado es donde van los paneles) y
     sobre él se apilan dos cuerpos más, cada vez más pequeños. */
  const tierZ = -0.55;
  const tiers = [
    { w: 5.4, d: 3.4, h: 1.9, y: 5.0, roofR: 4.8, roofH: 1.4 },
    { w: 3.6, d: 2.4, h: 1.5, y: 8.7, roofR: 3.4, roofH: 1.15 },
  ];

  // faldón de unión entre la cumbrera y la primera plataforma (sin huecos)
  group.add(box(6.0, 0.55, 4.0, darkWoodMat, 0, 5.05, tierZ));

  tiers.forEach((t) => {
    const tier = new THREE.Group();
    tier.position.set(0, t.y, tierZ);

    // plataforma y balcón de madera
    tier.add(box(t.w + 0.7, 0.14, t.d + 0.7, darkWoodMat, 0, 0.07, 0));
    tier.add(box(t.w + 1.0, 0.1, t.d + 1.0, woodMat, 0, 0.18, 0));

    // pilares lacados y muro de barro
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        tier.add(box(0.15, t.h, 0.15, lacquerMat, sx * (t.w / 2), t.h / 2 + 0.22, sz * (t.d / 2)));
      }
    }
    tier.add(box(t.w, t.h, t.d, plasterMat, 0, t.h / 2 + 0.22, 0));

    // ventanas shoji en las cuatro caras
    for (const sz of [-1, 1]) {
      const nWin = sz > 0 ? (t.w > 4 ? 3 : 2) : 2;
      for (let i = 0; i < nWin; i++) {
        const wx = (i - (nWin - 1) / 2) * (t.w / (nWin + 0.6));
        const win = new THREE.Group();
        win.add(box(0.62, t.h * 0.58, 0.05, shojiMat, 0, 0, 0));
        for (let k = 1; k < 4; k++) {
          win.add(box(0.02, t.h * 0.58, 0.06, darkWoodMat, -0.31 + (k * 0.62) / 4, 0, 0.04));
        }
        for (let k = 1; k < 3; k++) {
          win.add(box(0.62, 0.02, 0.06, darkWoodMat, 0, -t.h * 0.29 + (k * t.h * 0.58) / 3, 0.04));
        }
        win.position.set(wx, t.h / 2 + 0.26, sz * (t.d / 2 + 0.06));
        if (sz < 0) win.rotation.y = Math.PI;
        tier.add(win);
      }
    }

    // barandilla del balcón
    for (let rx = -t.w / 2 - 0.4; rx <= t.w / 2 + 0.4; rx += 0.55) {
      tier.add(box(0.04, 0.32, 0.04, darkWoodMat, rx, 0.35, t.d / 2 + 0.45));
    }
    tier.add(box(t.w + 0.9, 0.045, 0.045, lacquerMat, 0, 0.52, t.d / 2 + 0.45));

    // ménsulas (tokyō) bajo el alero
    tier.add(box(t.w + 1.1, 0.14, t.d + 1.1, darkWoodMat, 0, t.h + 0.28, 0));
    for (let bx = -t.w / 2 - 0.3; bx <= t.w / 2 + 0.3; bx += 0.7) {
      tier.add(box(0.13, 0.18, 0.36, darkWoodMat, bx, t.h + 0.12, t.d / 2 + 0.3));
      tier.add(box(0.22, 0.07, 0.44, lacquerMat, bx, t.h, t.d / 2 + 0.32));
    }

    // tejado pagoda: faldón acampanado y pirámide de teja kawara
    const topR = t.roofR * 0.82;
    const flare = new THREE.Mesh(
      new THREE.CylinderGeometry(topR, t.roofR * 1.15, 0.34, 4, 1),
      eaveMat,
    );
    flare.rotation.y = Math.PI / 4;
    flare.position.y = t.h + 0.46;
    flare.castShadow = true;
    tier.add(flare);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(topR, t.roofH, 4, 1), kawaraMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = t.h + 0.63 + t.roofH / 2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    tier.add(roof);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), brassMat);
    knob.position.y = t.h + 0.63 + t.roofH;
    tier.add(knob);

    group.add(tier);
  });

  // remate (sorin) sobre el tejado superior
  const spireBase = tiers[1].y + tiers[1].h + 0.63 + tiers[1].roofH;
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.7, 8), goldMat);
  spire.position.set(0, spireBase + 0.85, tierZ);
  group.add(spire);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2 - i * 0.025, 0.02, 6, 16), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, spireBase + 0.25 + i * 0.22, tierZ);
    group.add(ring);
  }

  // farolillos colgantes bajo el alero
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe0a8,
    emissive: 0xffb347,
    emissiveIntensity: 1.4,
    roughness: 0.6,
  });
  for (const sx of [-4.4, 4.4]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), darkWoodMat);
    rope.position.set(sx, HOUSE.eaveY - 0.2, HOUSE.depth / 2 + 0.05);
    group.add(rope);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), lampMat);
    lantern.scale.set(1, 1.2, 1);
    lantern.position.set(sx, HOUSE.eaveY - 0.45, HOUSE.depth / 2 + 0.05);
    group.add(lantern);
  }

  /* --------------------------------------------------------- chimenea/farol */
  const chimBase = roofYAt(SITE.chimney.z);
  const chimneyGroup = new THREE.Group();
  chimneyGroup.add(box(0.9, 0.24, 0.9, stoneMat, 0, 0.12, 0));
  chimneyGroup.add(box(0.52, 1.5, 0.52, stoneMat, 0, 1.0, 0));
  chimneyGroup.add(box(0.86, 0.14, 0.86, stoneMat, 0, 1.8, 0));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 4), ridgeMat);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 2.06;
  cap.castShadow = true;
  chimneyGroup.add(cap);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 10), darkWoodMat);
  vent.position.y = 2.32;
  chimneyGroup.add(vent);
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

  // anclaje de línea de vida
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
  const invMat = new THREE.MeshStandardMaterial({ color: 0x2b353d, roughness: 0.5, metalness: 0.25 });
  inv.add(box(0.62, 0.8, 0.2, invMat, 0, 0, 0));
  inv.add(box(0.5, 0.24, 0.03, new THREE.MeshStandardMaterial({ color: 0x0d1a24, roughness: 0.3 }), 0, 0.18, 0.11));
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), new THREE.MeshBasicMaterial({ color: 0x46ff9f }));
  led.position.set(0.16, -0.18, 0.112);
  inv.add(led);
  inv.position.set(3.05, 1.55, HOUSE.depth / 2 + 0.14);
  group.add(inv);
  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 3.0, 8), metalMat);
  conduit.position.set(3.05, 3.0, HOUSE.depth / 2 + 0.1);
  group.add(conduit);

  // macetas de bonsái junto a la entrada
  const potMat = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.9 });
  const bonsaiMat = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.95, flatShading: true });
  for (const sx of [-1.7, 1.2]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.18, 12), potMat);
    pot.position.set(sx, 0.09, HOUSE.depth / 2 + 1.0);
    pot.castShadow = true;
    group.add(pot);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), bonsaiMat);
    bush.position.set(sx, 0.33, HOUSE.depth / 2 + 1.0);
    bush.scale.y = 0.8;
    bush.castShadow = true;
    group.add(bush);
  }

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
    materials: { plasterMat, kawaraMat, shojiMat, woodMat, metalMat, railMat },
  };
}
