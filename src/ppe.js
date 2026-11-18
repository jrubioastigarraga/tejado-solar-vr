import * as THREE from 'three';
import { makeLabelTexture } from './textures.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Equipos de protección individual: mesa, objetos, colocación sobre el cuerpo
 * y comprobaciones de seguridad.
 */
export function createPPE({ scene, textures, bench, player, camera, notify, onChange }) {
  const group = new THREE.Group();
  group.name = 'epi';
  scene.add(group);

  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1d2b3a, roughness: 0.75 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.65 });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xffd23f,
    roughness: 0.45,
    metalness: 0.05,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e2734,
    metalness: 0.6,
    roughness: 0.1,
    envMapIntensity: 1.6,
  });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.9 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff7a18, roughness: 0.7 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xb9c2c8, metalness: 0.9, roughness: 0.3 });

  function makeLabel(text) {
    const tex = makeLabelTexture(text, {
      width: 512,
      height: 128,
      bg: 'rgba(8,14,22,0.85)',
      border: 'rgba(255,194,71,0.45)',
      color: '#ffe7b3',
      radius: 34,
    });
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, toneMapped: false }),
    );
    sprite.scale.set(0.46, 0.115, 1);
    return sprite;
  }

  const entries = [];

  function addItem(id, label, builder, x, z) {
    const info = { id, label, equipped: false, basePos: new THREE.Vector3(), baseQuat: new THREE.Quaternion(), group: null };
    const item = new THREE.Group();
    item.add(builder());
    item.userData.ppe = info;
    info.group = item;

    const local = bench.group.localToWorld(new THREE.Vector3(x, bench.topY + 0.04, z));
    item.position.copy(local);
    item.rotation.y = bench.rotY + (id === 'harness' ? -0.2 : 0);
    group.add(item);

    info.basePos.copy(item.position);
    info.baseQuat.copy(item.quaternion);

    const lbl = makeLabel(label);
    lbl.position.set(0, 0.3, 0);
    item.add(lbl);
    info.labelSprite = lbl;

    // halo en la mesa
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 24),
      new THREE.MeshBasicMaterial({
        color: 0x46d99b,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.035;
    item.add(halo);

    item.userData.state = 'bench';
    item.userData.canGrab = true;
    item.userData.basePos = info.basePos;
    item.userData.baseQuat = info.baseQuat;
    entries.push(item);
    return item;
  }

  /* --------------------------------------------------------------- geometrías */
  function buildHelmet() {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.135, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      yellowMat,
    );
    dome.castShadow = true;
    g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.014, 26), yellowMat);
    brim.position.y = 0.005;
    brim.castShadow = true;
    g.add(brim);
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI), yellowMat);
    ridge.rotation.y = Math.PI / 2;
    ridge.position.y = 0.1;
    g.add(ridge);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.03, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.6 }));
    band.position.y = 0.035;
    g.add(band);
    return g;
  }

  function buildGoggles() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.08, 0.055), strapMat);
    frame.castShadow = true;
    g.add(frame);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.058, 0.01), lensMat);
    lens.position.z = 0.03;
    g.add(lens);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.009, 6, 22, Math.PI), strapMat);
    strap.rotation.x = Math.PI / 2;
    strap.rotation.z = Math.PI / 2;
    strap.position.z = -0.02;
    g.add(strap);
    return g;
  }

  function buildGloves() {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const glove = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.13), gloveMat);
      palm.castShadow = true;
      glove.add(palm);
      const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.026, 0.05), gloveMat);
      fingers.position.z = 0.085;
      glove.add(fingers);
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 4, 8), gloveMat);
      thumb.rotation.z = Math.PI / 2.4;
      thumb.position.set(side * 0.055, 0, 0.025);
      glove.add(thumb);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 10), cuffMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.z = -0.075;
      cuff.castShadow = true;
      glove.add(cuff);
      glove.position.x = side * 0.075;
      g.add(glove);
    }
    return g;
  }

  function buildHarness() {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.34), new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.85 }));
    g.add(pad);
    const strapA = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.36), orangeMat);
    strapA.position.set(-0.1, 0.05, 0);
    strapA.castShadow = true;
    g.add(strapA);
    const strapB = strapA.clone();
    strapB.position.x = 0.1;
    g.add(strapB);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 16), steelMat);
    ring.position.set(0, 0.12, 0.1);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.035, 0.06), strapMat);
    belt.position.set(0, 0.02, -0.12);
    g.add(belt);
    return g;
  }

  const items = {
    helmet: addItem('helmet', 'CASCO', buildHelmet, -0.98, 0.02),
    goggles: addItem('goggles', 'GAFAS', buildGoggles, -0.34, -0.05),
    gloves: addItem('gloves', 'GUANTES', buildGloves, 0.32, 0.0),
    harness: addItem('harness', 'ARNÉS', buildHarness, 0.98, 0.0),
  };

  /* ------------------------------------------------------------- visuales EPI */
  const bodyVisuals = new THREE.Group();
  bodyVisuals.name = 'epi-puesto';
  camera.add(bodyVisuals);

  const harnessVisual = new THREE.Group();
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.42, 0.018), orangeMat);
  strapL.position.set(-0.1, -0.4, -0.24);
  strapL.rotation.z = 0.1;
  const strapR = strapL.clone();
  strapR.position.x = 0.1;
  strapR.rotation.z = -0.1;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.018), strapMat);
  chest.position.set(0, -0.3, -0.245);
  const dring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12), steelMat);
  dring.position.set(0, -0.4, -0.26);
  harnessVisual.add(strapL, strapR, chest, dring);
  harnessVisual.scale.setScalar(0.9);
  bodyVisuals.add(harnessVisual);

  const brim = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.01, 6, 28, Math.PI * 1.05),
    yellowMat,
  );
  brim.rotation.x = Math.PI / 2;
  brim.rotation.z = Math.PI * 0.475;
  brim.position.set(0, 0.1, -0.02);
  bodyVisuals.add(brim);

  const glovesVisual = [];
  for (let i = 0; i < 2; i++) {
    const c = player.controllers[i];
    if (!c) continue;
    const g = buildGloves();
    g.scale.setScalar(0.85);
    g.rotation.x = -Math.PI / 2;
    g.rotation.z = 0.2;
    g.position.set(0, -0.02, -0.04);
    g.visible = false;
    c.grip.add(g);
    glovesVisual.push(g);
  }

  /* ------------------------------------------------------------------ estado */
  const equipped = { helmet: false, goggles: false, gloves: false, harness: false };
  const held = new Set();

  function syncVisuals() {
    const xr = !!player.state.xr;
    bodyVisuals.visible = xr;
    harnessVisual.visible = equipped.harness && xr;
    brim.visible = equipped.helmet && xr;
    for (const g of glovesVisual) g.visible = equipped.gloves && xr;
  }

  function equip(id) {
    if (equipped[id]) return false;
    const item = items[id];
    equipped[id] = true;
    item.userData.state = 'equipped';
    item.userData.canGrab = false;
    item.visible = false;
    syncVisuals();
    window.__sfx?.equip();
    notify?.(`${item.userData.ppe.label} colocado.`, 'ok');
    onChange?.(equipped);
    return true;
  }

  function equipHeld() {
    for (const item of held) {
      if (item.userData.state === 'held') {
        const id = item.userData.ppe.id;
        equip(id);
        return true;
      }
    }
    return false;
  }

  function equipDirect(item) {
    if (!item) return false;
    if (item.userData.state === 'equipped') return false;
    const id = item.userData.ppe.id;
    if (item.parent && item.parent !== group) scene.attach(item);
    item.visible = false;
    return equip(id);
  }

  function grab(item, controller) {
    if (item.userData.state === 'equipped') return false;
    item.userData.state = 'held';
    item.userData.canGrab = false;
    held.add(item);
    item.userData.labelSprite.visible = false;
    controller.attach(item);
    item.position.set(0, -0.02, -0.16);
    item.quaternion.identity();
    item.scale.setScalar(0.9);
    window.__sfx?.pick();
    notify?.(`${item.userData.ppe.label}: acércalo al cuerpo o pulsa A para ponértelo.`);
    return true;
  }

  function drop(item) {
    if (item.userData.state !== 'held') return;
    held.delete(item);
    item.userData.state = 'bench';
    item.userData.canGrab = true;
    scene.attach(item);
    const from = item.position.clone();
    const to = item.userData.basePos;
    const t0 = performance.now();
    const anim = () => {
      const k = Math.min(1, (performance.now() - t0) / 320);
      const e = 1 - Math.pow(1 - k, 3);
      item.position.lerpVectors(from, to, e);
      item.quaternion.slerp(item.userData.baseQuat, e);
      if (k < 1) requestAnimationFrame(anim);
      else {
        item.scale.setScalar(1);
        item.userData.labelSprite.visible = true;
      }
    };
    requestAnimationFrame(anim);
  }

  function update(dt) {
    syncVisuals();
    for (const item of [...held]) {
      if (item.userData.state !== 'held') continue;
      item.getWorldPosition(_v);
      const head = camera.getWorldPosition(new THREE.Vector3());
      if (_v.distanceTo(head) < 0.34) {
        const id = item.userData.ppe.id;
        held.delete(item);
        item.userData.state = 'equipped';
        item.visible = false;
        equip(id);
      }
    }
  }

  function reset() {
    for (const id of Object.keys(equipped)) {
      equipped[id] = false;
      const item = items[id];
      item.visible = true;
      item.userData.state = 'bench';
      item.userData.canGrab = true;
      item.userData.labelSprite.visible = true;
      item.scale.setScalar(1);
      if (item.parent !== group) group.attach(item);
      item.position.copy(item.userData.basePos);
      item.quaternion.copy(item.userData.baseQuat);
    }
    held.clear();
    harnessVisual.visible = false;
    brim.visible = false;
    for (const g of glovesVisual) g.visible = false;
    syncVisuals();
    onChange?.(equipped);
  }

  function isComplete() {
    return equipped.helmet && equipped.goggles && equipped.gloves && equipped.harness;
  }

  return {
    group,
    items,
    entries,
    equipped,
    equip,
    equipHeld,
    equipDirect,
    grab,
    drop,
    update,
    reset,
    isComplete,
    count: () => Object.values(equipped).filter(Boolean).length,
  };
}
