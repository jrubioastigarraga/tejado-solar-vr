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
      group.add(box(HOUSE.width + 0.06, 0.16, 0.14, darkWoodMat, 0, y, z));
    }
    for (const x of [-HOUSE.width / 2 - 0.02, HOUSE.width / 2 + 0.02]) {
      group.add(box(0.14, 0.16, HOUSE.depth + 0.06, darkWoodMat, x, y, 0));
    }
  }

  // hastiales de madera
  const shape = new THREE.Shape();
  shape.moveTo(-ROOF.halfDepth, 0);
  shape.lineTo(ROOF.halfDepth, 0);
  shape.lineTo(0, HOUSE.rise);
  shape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  gableGeo.rotateY(-Math.PI / 2);
  const gableR = new THREE.Mesh(gableGeo, darkWoodMat);
  gableR.position.set(HOUSE.width / 2 - 0.15, HOUSE.eaveY, 0);
  gableR.castShadow = true;
  gableR.receiveShadow = true;
  const gableL = gableR.clone();
  gableL.position.x = -HOUSE.width / 2 + 0.15;
  gableL.scale.x = -1;
  group.add(gableR, gableL);

  // hastiales decorados: plaster blanco, viga central y remate dorado
  for (const sx of [-1, 1]) {
    const shape2 = new THREE.Shape();
    shape2.moveTo(-ROOF.halfDepth * 0.72, 0.18);
    shape2.lineTo(ROOF.halfDepth * 0.72, 0.18);
    shape2.lineTo(0, HOUSE.rise * 0.76);
    shape2.closePath();
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape2), plasterMat);
    panel.rotation.y = (sx * Math.PI) / 2;
    panel.position.set(sx * (HOUSE.width / 2 + 0.02), HOUSE.eaveY + 0.12, 0);
    panel.castShadow = true;
    group.add(panel);

    const beam = box(0.07, HOUSE.rise * 0.72, 0.08, darkWoodMat, sx * (HOUSE.width / 2 + 0.05), HOUSE.eaveY + HOUSE.rise * 0.4, 0);
    group.add(beam);
    const medallion = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20), goldMat);
    medallion.rotation.y = (sx * Math.PI) / 2;
    medallion.position.set(sx * (HOUSE.width / 2 + 0.08), HOUSE.eaveY + HOUSE.rise * 0.42, 0);
    group.add(medallion);
  }

  // canecillos bajo el alero principal
  for (const z of [HOUSE.depth / 2 + 0.14, -HOUSE.depth / 2 - 0.14]) {
    for (let x = -5.5; x <= 5.5; x += 1.1) {
      group.add(box(0.14, 0.2, 0.4, darkWoodMat, x, HOUSE.eaveY - 0.12, z));
      group.add(box(0.24, 0.08, 0.5, lacquerMat, x, HOUSE.eaveY - 0.26, z));
    }
  }

  /* ----------------------------------------------------------------- faldón */
  function makeRoofPlane(sign) {
    const up = new THREE.Vector3(0, HOUSE.rise, -sign * ROOF.halfDepth).normalize();
    const nrm = new THREE.Vector3(0, ROOF.halfDepth, sign * HOUSE.rise).normalize();
    const bx = new THREE.Vector3(sign > 0 ? 1 : -1, 0, 0);
    const quat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(bx, up, nrm),
    );
    const length = ROOF.slopeLength + (sign > 0 ? 0.06 : 0.24);
    const width = HOUSE.width + ROOF.overhangX * 2 + 0.4;
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

  // cumbrera
  group.add(
    box(HOUSE.width + ROOF.overhangX * 2 + 0.6, 0.2, 0.44, ridgeMat, 0, ROOF.ridgeY + 0.09, 0),
  );

  // aleros curvados en las cuatro esquinas
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p0 = new THREE.Vector3(sx * (HOUSE.width / 2 + 0.3), HOUSE.eaveY + 0.02, sz * (HOUSE.depth / 2 + 0.14));
      const p1 = new THREE.Vector3(sx * (HOUSE.width / 2 + 0.62), HOUSE.eaveY + 0.16, sz * (HOUSE.depth / 2 + 0.34));
      const p2 = new THREE.Vector3(sx * (HOUSE.width / 2 + 0.86), HOUSE.eaveY + 0.52, sz * (HOUSE.depth / 2 + 0.5));
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.055, 6, false), darkWoodMat);
      tube.castShadow = true;
      group.add(tube);
    }
  }
  // remate del alero sur
  group.add(box(HOUSE.width + 0.9, 0.12, 0.12, darkWoodMat, 0, HOUSE.eaveY - 0.02, HOUSE.depth / 2 + 0.22));

  /* ------------------------------------------------------------- ventanas */
  function addShoji(x, y, z, w, h, facing = 1) {
    const g = new THREE.Group();
    g.add(box(w + 0.18, h + 0.18, 0.08, darkWoodMat, 0, 0, 0.02));
    g.add(plane(w, h, shojiMat, 0, 0, 0.07));
    for (let i = 1; i < 4; i++) {
      g.add(box(0.028, h, 0.02, darkWoodMat, -w / 2 + (i * w) / 4, 0, 0.085));
    }
    for (let i = 1; i < 3; i++) {
      g.add(box(w, 0.028, 0.02, darkWoodMat, 0, -h / 2 + (i * h) / 3, 0.085));
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
  group.add(box(1.9, 2.34, 0.08, darkWoodMat, doorX, 1.42, HOUSE.depth / 2 + 0.04));
  for (const s of [-1, 1]) {
    const panel = addShoji(doorX + s * 0.42, 1.4, HOUSE.depth / 2 + 0.14, 0.78, 2.06, 1);
    group.add(panel);
  }
  group.add(box(0.08, 2.2, 0.14, darkWoodMat, doorX, 1.4, HOUSE.depth / 2 + 0.2));
  // escalones de piedra
  group.add(box(2.3, 0.18, 0.6, stoneMat, doorX, 0.2, HOUSE.depth / 2 + 0.55));
  group.add(box(2.7, 0.14, 0.4, stoneMat, doorX, 0.08, HOUSE.depth / 2 + 0.95));

  /* ------------------------------------------------------ cuerpos de pagoda */
  const tierZ = -2.3;
  const tiers = [
    { w: 5.2, d: 3.8, h: 1.9, y: 5.9, roofR: 4.2, roofH: 1.7 },
    { w: 4.0, d: 2.9, h: 1.5, y: 8.3, roofR: 3.3, roofH: 1.5 },
    { w: 2.9, d: 2.1, h: 1.25, y: 10.3, roofR: 2.4, roofH: 1.3 },
  ];

  tiers.forEach((t, index) => {
    const tier = new THREE.Group();
    tier.position.set(0, t.y, tierZ);

    // plataforma y pilares lacados
    tier.add(box(t.w + 0.6, 0.16, t.d + 0.6, darkWoodMat, 0, 0.08, 0));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        tier.add(
          box(0.14, t.h, 0.14, lacquerMat, sx * (t.w / 2), t.h / 2 + 0.16, sz * (t.d / 2)),
        );
      }
    }
    tier.add(box(t.w, t.h, t.d, plasterMat, 0, t.h / 2 + 0.16, 0));

    // ventanas shoji al frente
    const nWin = index === 0 ? 3 : 2;
    for (let i = 0; i < nWin; i++) {
      const wx = (i - (nWin - 1) / 2) * (t.w / (nWin + 0.5));
      tier.add(box(0.52, t.h * 0.6, 0.05, shojiMat, wx, t.h / 2 + 0.2, t.d / 2 + 0.04));
      for (let k = 1; k < 3; k++) {
        tier.add(
          box(
            0.02,
            t.h * 0.6,
            0.02,
            darkWoodMat,
            wx - 0.26 + (k * 0.52) / 3,
            t.h / 2 + 0.2,
            t.d / 2 + 0.07,
          ),
        );
      }
    }

    // barandilla del balcón
    for (let rx = -t.w / 2; rx <= t.w / 2; rx += 0.62) {
      tier.add(box(0.04, 0.3, 0.04, darkWoodMat, rx, 0.3, t.d / 2 + 0.3));
    }
    tier.add(box(t.w + 0.2, 0.045, 0.045, lacquerMat, 0, 0.46, t.d / 2 + 0.3));

    // canecillos y alero
    tier.add(box(t.w + 1.0, 0.14, t.d + 1.0, darkWoodMat, 0, t.h + 0.22, 0));
    for (let bx = -t.w / 2; bx <= t.w / 2 + 0.01; bx += 0.75) {
      tier.add(box(0.12, 0.17, 0.34, darkWoodMat, bx, t.h + 0.07, t.d / 2 + 0.24));
      tier.add(box(0.2, 0.07, 0.42, lacquerMat, bx, t.h - 0.05, t.d / 2 + 0.26));
    }

    // tejado piramidal
    const roof = new THREE.Mesh(new THREE.ConeGeometry(t.roofR, t.roofH, 4, 1), kawaraMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = t.h + 0.32 + t.roofH / 2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    tier.add(roof);

    const eave = new THREE.Mesh(new THREE.ConeGeometry(t.roofR + 0.18, 0.26, 4, 1), ridgeMat);
    eave.rotation.y = Math.PI / 4;
    eave.position.y = t.h + 0.34;
    eave.castShadow = true;
    tier.add(eave);

    group.add(tier);
  });

  // remate (sorin)
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 1.5, 8), goldMat);
  spire.position.set(0, 13.55, tierZ);
  group.add(spire);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18 - i * 0.02, 0.022, 6, 16), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 13.0 + i * 0.2, tierZ);
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
