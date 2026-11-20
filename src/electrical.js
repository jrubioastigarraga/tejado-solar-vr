import * as THREE from 'three';
import { cloneRepeat, makeLabelTexture } from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _p = new THREE.Vector3();

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeCableLine(color) {
  const geo = new THREE.BufferGeometry();
  const count = 16;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  line.frustumCulled = false;
  return line;
}

function layoutCable(line, from, to, sag = 0.18) {
  const pos = line.geometry.attributes.position;
  const count = pos.count;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    _p.lerpVectors(from, to, t);
    // curva con caída: la cuerda cuelga entre los dos extremos
    _p.y -= Math.sin(t * Math.PI) * sag;
    pos.setXYZ(i, _p.x, _p.y, _p.z);
  }
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

/**
 * Cuadro eléctrico de la instalación: conector DC, puesta a tierra,
 * interruptor de corte y prueba de producción.
 */
export function createElectrical({ scene, world, textures, solar, notify, onChange }) {
  const group = new THREE.Group();
  group.name = 'electrico';
  scene.add(group);

  const deckY = world.deckY;
  const metalMat = new THREE.MeshStandardMaterial({
    map: cloneRepeat(textures.metal, 2, 1),
    normalMap: cloneRepeat(textures.normal.metal, 2, 1),
    normalScale: new THREE.Vector2(0.3, 0.3),
    color: 0xb3bcc4,
    roughness: 0.4,
    metalness: 0.8,
  });
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xdfe4e8, roughness: 0.52, metalness: 0.18 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2833, roughness: 0.6 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc8382b, roughness: 0.45, metalness: 0.25 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x7ecb3a, roughness: 0.45, metalness: 0.25 });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xffc23d,
    emissive: 0x8a5c00,
    emissiveIntensity: 0.2,
    roughness: 0.4,
    metalness: 0.2,
  });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.9 });

  /* ------------------------------------------------------------- cuadro */
  const cabinet = new THREE.Group();
  cabinet.position.set(2.0, deckY, 6.16);

  cabinet.add(box(0.62, 0.82, 0.22, cabinetMat, 0, 0.44, 0));
  cabinet.add(box(0.56, 0.76, 0.02, darkMat, 0, 0.44, -0.115));
  for (const sx of [-0.25, 0.25]) {
    cabinet.add(box(0.03, 0.7, 0.06, metalMat, sx, 0.44, -0.13));
  }
  // bisagras y tirador
  cabinet.add(box(0.06, 0.05, 0.03, metalMat, -0.27, 0.66, -0.13));
  cabinet.add(box(0.06, 0.05, 0.03, metalMat, -0.27, 0.24, -0.13));
  cabinet.add(box(0.14, 0.025, 0.03, metalMat, 0.2, 0.44, -0.14));

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.15),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(
        [
          { text: 'CUADRO ELÉCTRICO', size: 46, color: '#ffc247' },
          { text: 'DC · puesta a tierra', size: 30, color: '#cfe0ef' },
        ],
        { width: 640, height: 190, bg: 'rgba(9,16,26,0.94)', border: 'rgba(255,194,71,0.5)', radius: 22 },
      ),
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  label.position.set(0, 0.78, -0.132);
  label.rotation.y = Math.PI;
  cabinet.add(label);

  // tomas
  function makeSocket(colorMat, x, y) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 20), colorMat);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 8, 22), metalMat);
    ring.position.z = 0.026;
    g.add(ring);
    g.position.set(x, y, -0.13);
    return g;
  }
  const dcSocket = makeSocket(redMat, -0.15, 0.54);
  const peSocket = makeSocket(greenMat, 0.15, 0.54);
  cabinet.add(dcSocket, peSocket);

  // piloto de estado
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x3a1512,
    emissive: 0xb52a20,
    emissiveIntensity: 0.7,
    roughness: 0.35,
  });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), ledMat);
  led.position.set(0, 0.7, -0.132);
  cabinet.add(led);

  // interruptor de corte
  const switchButton = new THREE.Group();
  const switchBase = box(0.24, 0.2, 0.05, darkMat, 0, 0, 0);
  switchButton.add(switchBase);
  const lever = new THREE.Group();
  lever.position.set(0, 0, -0.035);
  const leverArm = box(0.05, 0.15, 0.045, yellowMat, 0, 0.06, 0);
  lever.add(leverArm);
  lever.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), yellowMat));
  switchButton.add(lever);
  switchButton.position.set(0, 0.19, -0.135);
  switchButton.userData.kind = 'button';
  cabinet.add(switchButton);

  const switchLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.08),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture('CORTE DC', {
        width: 512,
        height: 120,
        bg: 'rgba(9,16,26,0.9)',
        border: 'rgba(255,194,71,0.45)',
        color: '#ffe2a8',
        radius: 30,
      }),
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  switchLabel.position.set(0, 0.075, -0.14);
  switchLabel.rotation.y = Math.PI;
  cabinet.add(switchLabel);
  cabinet.add(box(0.7, 0.05, 0.34, metalMat, 0, 0.025, 0));

  group.add(cabinet);

  /* -------------------------------------------------------------- bobina */
  const drum = new THREE.Group();
  drum.position.set(-2.25, deckY, 5.9);
  drum.rotation.y = 0.25;

  const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.42, 22), rubberMat);
  drumBody.rotation.z = Math.PI / 2;
  drumBody.position.y = 0.31;
  drumBody.castShadow = true;
  drum.add(drumBody);
  for (const sx of [-0.24, 0.24]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.035, 24), metalMat);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(sx, 0.31, 0);
    flange.castShadow = true;
    drum.add(flange);
  }
  for (let i = 0; i < 5; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.013, 6, 30), rubberMat);
    coil.rotation.y = Math.PI / 2;
    coil.position.set(-0.16 + i * 0.08, 0.31, 0);
    drum.add(coil);
  }
  drum.add(box(0.62, 0.05, 0.5, metalMat, 0, 0.02, 0));
  group.add(drum);

  // anclajes de los dos cables en la bobina
  drum.updateMatrixWorld(true);
  const dcAnchor = drum.localToWorld(new THREE.Vector3(0.15, 0.72, -0.02));
  const peAnchor = drum.localToWorld(new THREE.Vector3(-0.15, 0.72, -0.02));

  /* ---------------------------------------------------------- conectores */
  function makeConnector(colorMat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.11, 16), rubberMat);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    g.add(body);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 16), colorMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.z = 0.03;
    collar.castShadow = true;
    g.add(collar);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), rubberMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = 0.13;
    g.add(tail);
    return g;
  }

  const dcConnector = makeConnector(redMat);
  const peConnector = makeConnector(greenMat);
  group.add(dcConnector, peConnector);

  const socketWorld = (socketGroup) => socketGroup.getWorldPosition(new THREE.Vector3());
  cabinet.updateMatrixWorld(true);
  const dcSocketPos = socketWorld(dcSocket);
  const peSocketPos = socketWorld(peSocket);

  const connectables = [
    {
      id: 'dc',
      label: 'cable DC',
      item: dcConnector,
      socket: dcSocketPos,
      flag: 'wired',
      basePos: dcAnchor.clone(),
    },
    {
      id: 'pe',
      label: 'puesta a tierra',
      item: peConnector,
      socket: peSocketPos,
      flag: 'grounded',
      basePos: peAnchor.clone(),
    },
  ];

  for (const c of connectables) {
    c.item.position.copy(c.basePos);
    c.item.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2);
    c.item.userData.state = 'drum';
    c.item.userData.connected = false;
    c.item.userData.kind = 'connector';
    c.item.userData.connectable = c;
  }

  const dcCable = makeCableLine(0xc8382b);
  const peCable = makeCableLine(0x8fd14f);
  group.add(dcCable, peCable);

  /* --------------------------------------------------------------- estado */
  const state = {
    wired: false,
    grounded: false,
    on: false,
    instantKw: 0,
    uptime: 0,
  };

  const returns = [];
  let leverTarget = -0.55;
  lever.rotation.x = -0.55;

  function updateSocketVisuals() {
    ledMat.color.setHex(state.on ? 0x1a7a45 : 0x3a1512);
    ledMat.emissive.setHex(state.on ? 0x46ff9f : 0xb52a20);
    ledMat.emissiveIntensity = state.on ? 1.5 : 0.7;
  }

  function connect(item) {
    const c = item.userData.connectable;
    scene.attach(item);
    item.position.copy(c.socket).addScaledVector(new THREE.Vector3(0, 0, 1), 0.02);
    item.quaternion.identity();
    item.scale.setScalar(1);
    item.userData.state = 'connected';
    item.userData.connected = true;
    item.userData.canGrab = false;
    state[c.flag] = true;
    updateSocketVisuals();
    notify?.(`${c.label} conectado.`, 'ok');
    if (window.__sfx) window.__sfx.snap();
    onChange?.();
  }

  function beginHold(item, holder) {
    if (!item || item.userData.connected) return false;
    if (item.userData.state === 'held') return false;
    item.userData.state = 'held';
    holder.attach(item);
    item.position.set(0, -0.03, -0.22);
    item.quaternion.identity();
    item.scale.setScalar(0.85);
    notify?.('Acerca el conector a su toma del cuadro y suéltalo.', '');
    if (window.__sfx) window.__sfx.pick();
    return true;
  }

  function release(item) {
    if (!item || item.userData.state !== 'held') return;
    const c = item.userData.connectable;
    item.getWorldPosition(_p);
    if (_p.distanceTo(c.socket) < 0.6) {
      connect(item);
      return;
    }
    scene.attach(item);
    returns.push({
      item,
      from: item.position.clone(),
      fromQ: item.quaternion.clone(),
      to: c.basePos.clone(),
      toQ: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2),
      t: 0,
      dur: 0.32,
    });
    item.userData.state = 'returning';
    notify?.('El conector no ha llegado a la toma. Acércate al cuadro.', 'err');
    if (window.__sfx) window.__sfx.error();
  }

  function activateSwitch() {
    if (state.on) {
      notify?.('El sistema ya está en marcha.', '');
      return false;
    }
    if (!state.wired) {
      notify?.('Falta el cable DC: conéctalo a la toma roja del cuadro.', 'err');
      if (window.__sfx) window.__sfx.error();
      return false;
    }
    if (!state.grounded) {
      notify?.('Falta la puesta a tierra: conecta el cable verde antes de dar tensión.', 'err');
      if (window.__sfx) window.__sfx.error();
      return false;
    }
    state.on = true;
    state.uptime = 0;
    leverTarget = 0.6;
    updateSocketVisuals();
    updateProduction();
    notify?.(
      `Sistema en marcha: ${state.instantKw.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} kW ahora mismo.`,
      'ok',
    );
    if (window.__sfx) window.__sfx.success();
    onChange?.();
    return true;
  }

  function updateProduction() {
    const eff = Number.isFinite(solar?.state?.efficiency) ? solar.state.efficiency : 1;
    state.instantKw = Math.max(0, solar?.state?.kwp || 0) * eff * 0.87;
  }

  function update(dt) {
    // cables
    const dcEnd = _a;
    const peEnd = _b;
    dcConnector.getWorldPosition(dcEnd);
    peConnector.getWorldPosition(peEnd);
    layoutCable(dcCable, dcAnchor, dcEnd, dcConnector.userData.connected ? 0.06 : 0.16);
    layoutCable(peCable, peAnchor, peEnd, peConnector.userData.connected ? 0.06 : 0.16);

    // retorno de los conectores a la bobina
    for (let i = returns.length - 1; i >= 0; i--) {
      const r = returns[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const e = 1 - Math.pow(1 - k, 3);
      r.item.position.lerpVectors(r.from, r.to, e);
      r.item.quaternion.slerpQuaternions(r.fromQ, r.toQ, e);
      if (k >= 1) {
        r.item.userData.state = 'drum';
        r.item.scale.setScalar(1);
        returns.splice(i, 1);
      }
    }

    // palanca
    lever.rotation.x += (leverTarget - lever.rotation.x) * Math.min(1, dt * 12);

    if (state.on) {
      state.uptime += dt;
      updateProduction();
      const pulse = 0.85 + Math.sin(state.uptime * 3.2) * 0.25;
      ledMat.emissiveIntensity = pulse;
    }
  }

  function reset() {
    returns.length = 0;
    state.wired = false;
    state.grounded = false;
    state.on = false;
    state.instantKw = 0;
    state.uptime = 0;
    leverTarget = -0.55;
    lever.rotation.x = -0.55;
    for (const c of connectables) {
      const item = c.item;
      if (item.parent !== group) group.attach(item);
      item.position.copy(c.basePos);
      item.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2);
      item.scale.setScalar(1);
      item.userData.state = 'drum';
      item.userData.connected = false;
      item.userData.canGrab = true;
    }
    updateSocketVisuals();
    updateProduction();
  }

  function debugConnect() {
    for (const c of connectables) {
      const item = c.item;
      scene.attach(item);
      item.position.copy(c.socket).addScaledVector(new THREE.Vector3(0, 0, 1), 0.02);
      item.quaternion.identity();
      item.scale.setScalar(1);
      item.userData.state = 'connected';
      item.userData.connected = true;
      item.userData.canGrab = false;
      state[c.flag] = true;
    }
    state.on = true;
    leverTarget = 0.6;
    lever.rotation.x = 0.6;
    updateSocketVisuals();
    updateProduction();
    onChange?.();
  }

  updateSocketVisuals();
  updateProduction();

  return {
    group,
    cabinet,
    drum,
    switchButton,
    connectables,
    state,
    beginHold,
    release,
    activateSwitch,
    updateProduction,
    update,
    reset,
    debugConnect,
  };
}
