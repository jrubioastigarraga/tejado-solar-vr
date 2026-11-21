import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * Rayos de los mandos (o del ratón) contra objetos interactivos:
 * paneles, EPIs y pulsadores.
 */
export function createInteractions({ renderer, scene, camera, player }) {
  const entries = [];
  const pointers = [];
  const raycaster = new THREE.Raycaster();

  const desktopHand = new THREE.Object3D();
  desktopHand.position.set(0.22, -0.28, -0.52);
  camera.add(desktopHand);

  function makeLaser(parent) {
    const geo = new THREE.CylinderGeometry(0.0022, 0.0022, 1, 6, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -0.5);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0x8df7cf,
        transparent: true,
        opacity: 0.7,
        toneMapped: false,
        depthWrite: false,
      }),
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    parent.add(mesh);
    return mesh;
  }

  for (const c of player.controllers) {
    pointers.push({
      kind: 'xr',
      controller: c,
      object: c.controller,
      held: null,
      hover: null,
      laser: makeLaser(c.controller),
      distance: 0,
    });
  }

  const desktop = {
    kind: 'desktop',
    object: desktopHand,
    held: null,
    hover: null,
    toggle: true,
  };
  pointers.push(desktop);

  function register(root, def) {
    const entry = { root, ...def };
    entries.push(entry);
    root.userData.entry = entry;
    return entry;
  }

  function registerGrab(root, opts = {}) {
    return register(root, {
      type: opts.type || 'grab',
      onGrab: opts.onGrab,
      onRelease: opts.onRelease,
      enabled: opts.enabled || (() => true),
      hoverScale: opts.hoverScale ?? 1.04,
      maxDistance: opts.maxDistance ?? 3.2,
      canHover: opts.canHover || (() => true),
    });
  }

  function registerButton(root, onClick, opts = {}) {
    return register(root, {
      type: 'button',
      onClick,
      enabled: opts.enabled || (() => true),
      hoverScale: opts.hoverScale ?? 1.06,
      maxDistance: opts.maxDistance ?? 3.8,
      canHover: opts.canHover || (() => true),
    });
  }

  function setHover(pointer, entry) {
    if (pointer.hover === entry) return;
    if (pointer.hover) {
      pointer.hover.root.scale.setScalar(1);
    }
    pointer.hover = entry;
    if (entry) {
      entry.root.scale.setScalar(entry.hoverScale || 1.04);
    }
  }

  function roots() {
    return entries.filter((e) => e.enabled()).map((e) => e.root);
  }

  function pick(pointer) {
    if (!pointer) return null;
    let origin;
    let dir;
    let far = 3.4;
    if (pointer.kind === 'xr') {
      const m = pointer.object.matrixWorld;
      origin = _origin.setFromMatrixPosition(m);
      dir = _dir.set(0, 0, -1).transformDirection(m);
    } else {
      origin = camera.getWorldPosition(_origin);
      dir = camera.getWorldDirection(_dir);
    }
    raycaster.set(origin, dir);
    raycaster.far = far;
    raycaster.camera = camera;
    const list = roots();
    if (!list.length) return null;
    const hits = raycaster.intersectObjects(list, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && !obj.userData.entry) obj = obj.parent;
    const entry = obj?.userData.entry;
    if (!entry) return null;
    if (hits[0].distance > (entry.maxDistance ?? 3.2)) return null;
    return { entry, distance: hits[0].distance };
  }

  function tryGrab(pointer) {
    const hit = pick(pointer);
    if (!hit) return;
    const { entry } = hit;
    if (entry.type === 'button') {
      entry.onClick?.(pointer);
      return;
    }
    const ok = entry.onGrab?.(entry.root, pointer.object, pointer);
    if (ok !== false) pointer.held = entry;
  }

  function release(pointer) {
    if (!pointer.held) return;
    const entry = pointer.held;
    pointer.held = null;
    entry.onRelease?.(entry.root, pointer);
  }

  for (const p of pointers) {
    if (p.kind !== 'xr') continue;
    p.object.addEventListener('selectstart', () => {
      if (!player.state.xr) return;
      tryGrab(p);
    });
    p.object.addEventListener('selectend', () => {
      if (!player.state.xr) return;
      release(p);
    });
  }

  // escritorio: bloquear puntero y usar clic como alternancia
  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', (e) => {
    if (player.state.xr) return;
    if (!document.pointerLockElement) {
      canvas.requestPointerLock?.();
      return;
    }
    if (e.button !== 0) return;
    if (desktop.held) release(desktop);
    else tryGrab(desktop);
  });

  function hovered() {
    if (player.state.xr) {
      for (const p of pointers) {
        if (p.kind === 'xr' && p.hover) return p.hover;
      }
      return null;
    }
    return desktop.hover;
  }

  function update(dt) {
    const active = player.state.xr ? pointers.filter((p) => p.kind === 'xr') : [desktop];
    for (const p of active) {
      if (p.held) {
        p.laser && (p.laser.visible = false);
        continue;
      }
      if (p.kind === 'desktop' && !player.state.locked) {
        setHover(p, null);
        continue;
      }
      const hit = pick(p);
      setHover(p, hit ? hit.entry : null);
      if (p.laser) {
        if (hit) {
          p.laser.visible = true;
          p.laser.scale.z = hit.distance;
          p.laser.material.color.setHex(0x8df7cf);
        } else {
          p.laser.visible = false;
        }
      }
    }

    // los objetos cogidos no deben quedar "escalados" al soltar
    for (const e of entries) {
      if (!e.enabled() && e.root.scale.x !== 1) e.root.scale.setScalar(1);
    }
  }

  function releaseHeld(root) {
    for (const p of pointers) {
      if (p.held?.root === root) release(p);
    }
  }

  function releaseAll() {
    for (const p of pointers) release(p);
    for (const p of pointers) setHover(p, null);
  }

  function debugPick() {
    const hit = pick(desktop);
    return hit ? { type: hit.entry.type, distance: hit.distance } : null;
  }

  return {
    registerGrab,
    registerButton,
    update,
    releaseAll,
    releaseHeld,
    hovered,
    debugPick,
    desktop,
    pointers,
    entries,
  };
}
