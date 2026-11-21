import * as THREE from 'three';
import { HOUSE, SITE, roofYAt } from './config.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

function makeWristBand() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.035, 0.012, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0x232a31, roughness: 0.7 }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.01;
  g.add(band);
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x6fe3ff }),
  );
  dot.position.set(0, 0, -0.03);
  g.add(dot);
  return g;
}

export function createPlayer({ renderer, scene }) {
  const rig = new THREE.Group();
  rig.name = 'jugador';
  scene.add(rig);

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 620);
  rig.add(camera);

  const controllers = [];
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    rig.add(controller, grip);
    grip.add(makeWristBand());
    const c = {
      index: i,
      controller,
      grip,
      axes: { x: 0, y: 0 },
      buttons: [],
      data: null,
      connected: false,
      aPressed: false,
      jumpPressed: false,
    };
    controller.addEventListener('connected', (e) => {
      c.data = e.data;
      c.connected = true;
      controller.visible = true;
    });
    controller.addEventListener('disconnected', () => {
      c.connected = false;
      c.data = null;
    });
    controllers.push(c);
  }

  const state = {
    xr: false,
    groundY: 0,
    eye: 1.66,
    speed: 0,
    keys: new Set(),
    yaw: 0,
    pitch: 0,
    snapCooldown: 0,
    locked: false,
    bounds: 0,
    jumpY: 0,
    jumpVel: 0,
  };

  const player = {
    rig,
    camera,
    controllers,
    state,
    onAction: null,

    groundHeightAt(x, z) {
      // faldón sur transitable
      if (Math.abs(x) <= HOUSE.width / 2 - 0.05 && z >= 0.06 && z <= HOUSE.depth / 2) {
        return roofYAt(z);
      }
      // plataforma de andamio
      if (
        x >= SITE.platform.x0 &&
        x <= SITE.platform.x1 &&
        z >= SITE.platform.z0 &&
        z <= SITE.platform.z1
      ) {
        return SITE.platform.y;
      }
      // volumen de la casa (no transitable)
      if (
        Math.abs(x) <= HOUSE.width / 2 + 0.3 &&
        z >= -HOUSE.depth / 2 - 0.3 &&
        z <= HOUSE.depth / 2 + 0.3
      ) {
        return 50;
      }
      return 0;
    },

    onRoof() {
      return state.groundY > 2.0;
    },

    teleport(x, z, yaw = 0) {
      const h = this.groundHeightAt(x, z);
      state.groundY = h;
      state.jumpY = 0;
      state.jumpVel = 0;
      rig.position.set(x, h + (state.xr ? 0 : state.eye), z);
      rig.rotation.y = yaw;
      state.yaw = yaw;
      state.pitch = 0;
      camera.rotation.set(0, 0, 0);
    },

    resetToStart() {
      this.teleport(SITE.start.x, SITE.start.z, 0);
    },

    setXR(on) {
      state.xr = on;
      camera.rotation.set(0, 0, 0);
      state.pitch = 0;
      const base = state.groundY + (on ? 0 : state.eye);
      rig.position.y = base;
    },

    update(dt) {
      // --- giro y movimiento
      let mx = 0;
      let my = 0;

      if (state.xr) {
        const left = controllers[0];
        const right = controllers[1];
        if (left?.data?.gamepad) {
          const gp = left.data.gamepad;
          let x = gp.axes[2] ?? 0;
          let y = gp.axes[3] ?? 0;
          if (Math.abs(x) < 0.12 && Math.abs(y) < 0.12) {
            x = gp.axes[0] ?? 0;
            y = gp.axes[1] ?? 0;
          }
          mx = Math.abs(x) > 0.16 ? x : 0;
          my = Math.abs(y) > 0.16 ? y : 0;
          // botón A/X del mando izquierdo: saltar
          const jb = gp.buttons?.[4] || gp.buttons?.[5];
          if (jb?.pressed && !left.jumpPressed) {
            left.jumpPressed = true;
            if (state.jumpY <= 0 && state.jumpVel <= 0) state.jumpVel = 4.8;
          } else if (!jb?.pressed) {
            left.jumpPressed = false;
          }
        }
        if (right?.data?.gamepad) {
          const gp = right.data.gamepad;
          const sx = gp.axes[2] ?? gp.axes[0] ?? 0;
          if (Math.abs(sx) > 0.72 && state.snapCooldown <= 0) {
            rig.rotation.y -= Math.sign(sx) * THREE.MathUtils.degToRad(30);
            state.snapCooldown = 0.32;
            window.__sfx?.tick();
          }
          // botón A/X para equipar
          const b = gp.buttons?.[4] || gp.buttons?.[5];
          if (b?.pressed && !right.aPressed) {
            right.aPressed = true;
            player.onAction?.();
          } else if (!b?.pressed) {
            right.aPressed = false;
          }
        }
      } else {
        if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) my -= 1;
        if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) my += 1;
        if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) mx -= 1;
        if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) mx += 1;
      }

      state.snapCooldown = Math.max(0, state.snapCooldown - dt);

      if (mx !== 0 || my !== 0) {
        camera.getWorldDirection(_forward);
        _forward.y = 0;
        if (_forward.lengthSq() < 1e-5) _forward.set(0, 0, -1);
        _forward.normalize();
        _right.crossVectors(_forward, THREE.Object3D.DEFAULT_UP).normalize();
        _move.copy(_forward).multiplyScalar(-my).addScaledVector(_right, mx);
        if (_move.lengthSq() > 1) _move.normalize();

        const onRoof = state.groundY > 2.4;
        const speed = state.xr ? (onRoof ? 1.15 : 1.9) : onRoof ? 1.7 : 3.0;
        _move.multiplyScalar(speed * dt);

        const tryMove = (dx, dz) => {
          const nx = rig.position.x + dx;
          const nz = rig.position.z + dz;
          if (state.bounds && nx * nx + nz * nz > state.bounds * state.bounds) return false;
          const h = this.groundHeightAt(nx, nz);
          if (Math.abs(h - state.groundY) > 0.62) return false;
          // no atravesar la chimenea en la cubierta
          if (
            state.groundY > 2.4 &&
            Math.abs(nx - SITE.chimney.x) < 0.62 &&
            Math.abs(nz - SITE.chimney.z) < 0.62
          ) {
            return false;
          }
          // no atravesar el stock de paneles
          if (
            state.groundY > 2.4 &&
            nx > SITE.rack.x - 0.85 &&
            nx < SITE.rack.x + 0.85 &&
            nz > SITE.rack.z - 1.15 &&
            nz < SITE.rack.z + 1.15
          ) {
            return false;
          }
          rig.position.x = nx;
          rig.position.z = nz;
          state.groundY = h;
          return true;
        };

        if (!tryMove(_move.x, _move.z)) {
          tryMove(_move.x, 0);
          tryMove(0, _move.z);
        }
      }

      // gravedad del salto (1:1, como el resto del juego)
      if (state.jumpY > 0 || state.jumpVel > 0) {
        state.jumpVel -= 13.5 * dt;
        state.jumpY += state.jumpVel * dt;
        if (state.jumpY <= 0) {
          state.jumpY = 0;
          state.jumpVel = 0;
        }
      }

      if (this.state.xr) {
        rig.position.y += (state.groundY + state.jumpY - rig.position.y) * Math.min(1, dt * 14);
      } else {
        const targetY = state.groundY + state.eye + state.jumpY;
        rig.position.y += (targetY - rig.position.y) * Math.min(1, dt * 16);
      }
    },
  };

  // teclado
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      window.__game?.interactions?.releaseAll?.();
      return;
    }
    if (e.code === 'KeyE') {
      player.onActivate?.();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && state.jumpY <= 0 && state.jumpVel <= 0) state.jumpVel = 4.8;
      return;
    }
    state.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => state.keys.delete(e.code));

  // mirada con ratón (solo pantalla)
  window.addEventListener('mousemove', (e) => {
    if (!state.locked || state.xr) return;
    rig.rotation.y -= e.movementX * 0.0022;
    state.pitch = THREE.MathUtils.clamp(state.pitch - e.movementY * 0.0022, -1.35, 1.35);
    camera.rotation.x = state.pitch;
  });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement != null;
    document.body.classList.toggle('locked', state.locked);
  });

  return player;
}
