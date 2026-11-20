import * as THREE from 'three';
import {
  ENERGY,
  GRID,
  PANEL,
  ROOF,
  SITE,
  roofPoint,
  roofYAt,
} from './config.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * Paneles, guías, validación de huecos y modelo energético.
 */
export function createSolar({ textures, house, world, camera, notify, onChange, onTarget }) {
  const group = new THREE.Group();
  group.name = 'solar';
  house.group.add(group);

  /* ------------------------------------------------------------- materiales */
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xc2cad1,
    metalness: 0.85,
    roughness: 0.28,
    envMapIntensity: 1.1,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    map: textures.cells,
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.14,
    envMapIntensity: 1.5,
  });
  const backMat = new THREE.MeshStandardMaterial({ color: 0xe9edf0, roughness: 0.55 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.8 });
  const dustMat = new THREE.MeshStandardMaterial({
    map: textures.dust,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
    color: 0xffffff,
  });

  /* ------------------------------------------------------------------ huecos */
  const slots = [];
  const halfW = GRID.cols / 2 - 0.5;
  const chimney = SITE.chimney;

  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      const x = (col - halfW) * GRID.colStep + GRID.centerX;
      const d = GRID.firstRowD + row * GRID.rowStep;
      const pos = roofPoint(x, d).addScaledVector(ROOF.normal, GRID.raise);
      const blockedX = Math.abs(x - chimney.x) < PANEL.width / 2 + chimney.w / 2 - 0.05;
      const blockedZ = Math.abs(pos.z - chimney.z) < 0.55;
      const blocked = blockedX && blockedZ;
      const shade = blocked ? 1 : world.shadeAt(pos, ROOF.normal);
      slots.push({
        index: slots.length,
        row,
        col,
        x,
        d,
        position: pos,
        quaternion: ROOF.quaternion.clone(),
        blocked,
        blockedReason: blocked ? 'La chimenea ocupa este hueco' : '',
        shade,
        panel: null,
      });
    }
  }

  const validSlots = slots.filter((s) => !s.blocked);

  /* --------------------------------------------------------------- retícula */
  const reticleGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(PANEL.width + 0.06, PANEL.height + 0.06));
  const reticleMat = new THREE.LineBasicMaterial({
    color: 0x46d99b,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });
  const reticle = new THREE.LineSegments(reticleGeo, reticleMat);
  reticle.visible = false;
  reticle.userData.kind = 'reticle';
  group.add(reticle);

  /* ---------------------------------------------------------------- paneles */
  const panels = [];
  const rackQuat = ROOF.quaternion
    .clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
  const stackCenter = roofPoint(SITE.rack.x, 1.22);

  function stackPosition(i) {
    return stackCenter.clone().addScaledVector(ROOF.normal, 0.075 + i * 0.038);
  }

  function makePanel() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(PANEL.width, PANEL.height, 0.035), frameMat);
    frame.castShadow = true;
    frame.receiveShadow = true;
    g.add(frame);

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(PANEL.width - 0.065, PANEL.height - 0.065, 0.012),
      glassMat,
    );
    glass.position.z = 0.022;
    glass.castShadow = true;
    g.add(glass);

    const dust = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL.width - 0.07, PANEL.height - 0.07),
      dustMat,
    );
    dust.position.z = 0.031;
    dust.visible = false;
    g.add(dust);

    const jbox = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.035), cableMat);
    jbox.position.set(0.42, 0.2, -0.035);
    g.add(jbox);
    const cable = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 12, Math.PI), cableMat);
    cable.position.set(0.42, 0.12, -0.045);
    cable.rotation.z = Math.PI;
    g.add(cable);

    g.userData = {
      type: 'panel',
      state: 'rack',
      slot: null,
      canGrab: true,
      holder: null,
      dust: 0,
      dustAssigned: false,
      dustMesh: dust,
    };
    return g;
  }

  for (let i = 0; i < 16; i++) {
    const p = makePanel();
    group.add(p);
    panels.push(p);
  }

  const rackPanels = () => panels.filter((p) => p.userData.state === 'rack');

  function refreshRack() {
    const list = rackPanels();
    list.forEach((p, i) => {
      p.position.copy(stackPosition(i));
      p.quaternion.copy(rackQuat);
      p.scale.setScalar(1);
    });
    group.updateMatrixWorld(true);
  }
  refreshRack();

  /* --------------------------------------------------------------- estado */
  const state = {
    placed: 0,
    kwp: 0,
    annualKwh: 0,
    shadeAvg: 1,
    efficiency: 1,
    dusty: 0,
    dustWarned: false,
    available: 16,
    validSlots: validSlots.length,
    target: null,
    targetShade: null,
  };

  /** Algunos huecos llegan con polvo: reducen la producción hasta limpiarlos. */
  function setDust(panel, slot) {
    if (panel.userData.dustAssigned) return;
    panel.userData.dustAssigned = true;
    const dusty = slot.index % 5 === 2;
    panel.userData.dust = dusty ? 0.16 : 0;
    panel.userData.dustMesh.visible = dusty;
    if (dusty && !state.dustWarned) {
      state.dustWarned = true;
      notify?.('Ese panel tiene polvo: coge el cepillo y frótalo para recuperar rendimiento.', '');
    }
  }

  function recompute() {
    let kwh = 0;
    let shadeSum = 0;
    let placed = 0;
    let dusty = 0;
    for (const s of slots) {
      if (!s.panel) continue;
      placed++;
      const dust = 1 - (s.panel.userData.dust || 0);
      kwh += (PANEL.watts / 1000) * ENERGY.yieldPerKwp * s.shade * dust;
      shadeSum += s.shade;
      if (s.panel.userData.dust > 0) dusty++;
    }
    state.placed = placed;
    state.kwp = (placed * PANEL.watts) / 1000;
    state.annualKwh = Math.round(kwh);
    state.shadeAvg = placed ? shadeSum / placed : 1;
    state.efficiency = state.kwp > 0 ? kwh / (state.kwp * ENERGY.yieldPerKwp) : 1;
    state.dusty = dusty;
    state.available = rackPanels().length;
    onChange?.(state);
    return state;
  }

  function cleanPanel(panel) {
    if (!panel || panel.userData.dust <= 0) return false;
    panel.userData.dust = 0;
    panel.userData.dustMesh.visible = false;
    recompute();
    notify?.('Panel limpio: recupera el 100 % de rendimiento.', 'ok');
    if (window.__sfx) window.__sfx.snap();
    return true;
  }

  function dustyPanels() {
    return panels.filter((p) => p.userData.state === 'installed' && p.userData.dust > 0);
  }

  /* ------------------------------------------------------------ posicionado */
  const anims = [];
  function animateTo(obj, pos, quat, dur, onDone) {
    anims.push({
      obj,
      from: obj.position.clone(),
      fromQ: obj.quaternion.clone(),
      to: pos.clone(),
      toQ: quat.clone(),
      t: 0,
      dur,
      onDone,
    });
  }

  function findTarget(panel) {
    const p = panel.position;
    let best = null;
    let bestD = 1.85;
    for (const s of slots) {
      if (s.blocked || (s.panel && s.panel !== panel)) continue;
      const d = p.distanceTo(s.position);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  function clearTarget() {
    if (state.target) {
      state.target = null;
      state.targetShade = null;
      reticle.visible = false;
      onTarget?.(null);
    }
  }

  function setTarget(slot) {
    if (slot === state.target) return;
    state.target = slot;
    if (!slot) {
      reticle.visible = false;
      onTarget?.(null);
      return;
    }
    reticle.position.copy(slot.position).addScaledVector(ROOF.normal, 0.08);
    reticle.quaternion.copy(slot.quaternion);
    reticle.visible = true;
    reticleMat.color.setHex(0x46d99b);
    onTarget?.(slot);
  }

  function beginHold(panel) {
    if (panels.some((p) => p !== panel && p.userData.state === 'held')) {
      notify?.('Suelta el panel que llevas antes de coger otro.', 'err');
      if (window.__sfx) window.__sfx.error();
      return false;
    }
    panel.userData.holder = true;
    panel.userData.canGrab = false;
    panel.userData.state = 'held';
    if (panel.userData.slot) {
      panel.userData.slot.panel = null;
      panel.userData.slot = null;
    }
    refreshRack();
    recompute();
    return true;
  }

  function place(panel, slot) {
    panel.userData.state = 'placing';
    panel.userData.canGrab = false;
    setDust(panel, slot);
    slot.panel = panel;
    animateTo(panel, slot.position, slot.quaternion, 0.22, () => {
      panel.userData.state = 'installed';
      panel.userData.slot = slot;
      panel.userData.canGrab = true;
      slot.panel = panel;
      panel.position.copy(slot.position);
      panel.quaternion.copy(slot.quaternion);
      recompute();
    });
    setTarget(null);
    notify?.('Panel fijado a las guías. ¡Bien!', 'ok');
    if (window.__sfx) window.__sfx.snap();
  }

  function returnToRack(panel, message) {
    panel.userData.state = 'returning';
    panel.userData.canGrab = false;
    panel.userData.holder = false;
    const list = rackPanels();
    const idx = list.length;
    const pos = stackPosition(idx);
    animateTo(panel, pos, rackQuat, 0.35, () => {
      panel.userData.state = 'rack';
      panel.userData.canGrab = true;
      refreshRack();
      recompute();
    });
    if (message) notify?.(message, 'err');
    if (window.__sfx) window.__sfx.pick();
    clearTarget();
  }

  function release(panel) {
    if (panel.userData.state !== 'held') return;
    const target = state.target;
    if (target && !target.panel && !target.blocked) {
      place(panel, target);
      return;
    }
    returnToRack(panel, 'Acerca el panel a una guía libre hasta que el marco se ponga verde.');
  }

  /* ------------------------------------------------------------------ update */
  function update(dt) {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const e = 1 - Math.pow(1 - k, 3);
      a.obj.position.lerpVectors(a.from, a.to, e);
      a.obj.quaternion.slerpQuaternions(a.fromQ, a.toQ, e);
      if (k >= 1) {
        anims.splice(i, 1);
        a.onDone?.();
      }
    }

    // panel en la mano: sigue al jugador o se acopla a la guía
    let held = null;
    for (const p of panels) {
      if (p.userData.state === 'held') {
        held = p;
        break;
      }
    }

    if (!held) {
      clearTarget();
      return;
    }

    const target = findTarget(held);
    setTarget(target);

    const camPos = camera.getWorldPosition(_v1);
    const camDir = camera.getWorldDirection(_v2);
    camDir.y = 0;
    if (camDir.lengthSq() < 0.001) camDir.set(0, 0, -1);
    camDir.normalize();
    const right = _v3.crossVectors(camDir, THREE.Object3D.DEFAULT_UP).normalize();

    const carryPos = _v1.clone().addScaledVector(camDir, 0.95);
    carryPos.y = camPos.y - 0.68;

    const carryQ = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        right,
        camDir.clone(),
        new THREE.Vector3(0, 1, 0),
      ),
    );

    if (target) {
      const pos = target.position.clone().addScaledVector(ROOF.normal, 0.05);
      held.position.lerp(pos, 1 - Math.exp(-9 * dt));
      held.quaternion.slerp(target.quaternion, 1 - Math.exp(-9 * dt));
    } else {
      held.position.lerp(carryPos, 1 - Math.exp(-11 * dt));
      held.quaternion.slerp(carryQ, 1 - Math.exp(-11 * dt));
    }
  }

  function reset() {
    clearTarget();
    anims.length = 0;
    for (const s of slots) s.panel = null;
    for (const p of panels) {
      p.userData.state = 'rack';
      p.userData.slot = null;
      p.userData.holder = null;
      p.userData.canGrab = true;
      p.userData.dust = 0;
      p.userData.dustAssigned = false;
      p.userData.dustMesh.visible = false;
      p.scale.setScalar(1);
    }
    state.dustWarned = false;
    refreshRack();
    recompute();
  }

  function debugPlace(n) {
    clearTarget();
    const free = validSlots.filter((s) => !s.panel).slice(0, n);
    const avail = panels.filter((p) => p.userData.state === 'rack');
    free.forEach((slot, i) => {
      const p = avail[i];
      if (!p) return;
      p.userData.state = 'installed';
      p.userData.slot = slot;
      p.userData.canGrab = true;
      p.position.copy(slot.position);
      p.quaternion.copy(slot.quaternion);
      setDust(p, slot);
      slot.panel = p;
    });
    refreshRack();
    recompute();
  }

  const api = {
    group,
    slots,
    panels,
    state,
    validSlots: validSlots.length,
    validSlotList: validSlots,
    reticle,
    update,
    beginHold,
    release,
    reset,
    recompute,
    findTarget,
    refreshRack,
    debugPlace,
    cleanPanel,
    dustyPanels,
  };

  recompute();
  return api;
}
