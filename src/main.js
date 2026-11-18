import * as THREE from 'three';
import { buildTextures } from './textures.js';
import { createHouse } from './house.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createHUD } from './hud.js';
import { createPPE } from './ppe.js';
import { createSolar } from './solar.js';
import { createInteractions } from './interactions.js';
import { createGame } from './game.js';
import { createAudio } from './audio.js';
import { mergeStatic } from './optimize.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const intro = document.getElementById('intro');
const loading = document.getElementById('loading');
const btnVR = document.getElementById('btn-vr');
const btnFlat = document.getElementById('btn-flat');
const vrNote = document.getElementById('vr-note');
const btnRestart = document.getElementById('btn-restart');
const btnCloseResults = document.getElementById('btn-close-results');

/* ------------------------------------------------------------------ renderer */
const glTest = document.createElement('canvas').getContext('webgl2');
if (!glTest) {
  const l = document.getElementById('loading');
  if (l) {
    l.innerHTML =
      '<div style="max-width:520px;text-align:center;padding:24px"><h2 style="color:#ffc247">WebGL 2 no disponible</h2><p>Este navegador no puede renderizar la escena. Actualiza el navegador del visor o prueba Chrome/Edge en el ordenador.</p></div>';
  }
  throw new Error('WebGL2 requerido');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fbfd8);

/* --------------------------------------------------------------- construcción */
const textures = buildTextures(renderer);

const house = createHouse(textures);
mergeStatic(house.group, new Set([house.chimney]));
scene.add(house.group);
house.group.updateMatrixWorld(true);

const world = createWorld({ scene, renderer, textures, house });
const player = createPlayer({ renderer, scene });
const hud = createHUD({ camera: player.camera, player, world, scene });
const audio = createAudio();

let game = null;

const ppe = createPPE({
  scene,
  textures,
  bench: world.bench,
  player,
  camera: player.camera,
  notify: (text, kind) => hud.toast(text, kind),
  onChange: () => game?.refreshAll(),
});

const solar = createSolar({
  textures,
  house,
  world,
  camera: player.camera,
  notify: (text, kind) => hud.toast(text, kind),
  onChange: () => game?.refreshAll(),
  onTarget: (slot) => hud.setState({ target: slot }),
});

const interactions = createInteractions({
  renderer,
  scene,
  camera: player.camera,
  player,
});

game = createGame({
  player,
  solar,
  ppe,
  hud,
  world,
  interactions,
  audio,
});

window.__game = game;
window.__THREE = THREE;
window.__scene = scene;
window.__renderer = renderer;

/* ---------------------------------------------------------------- inicio */
let started = false;

function hideIntro() {
  intro.classList.add('hidden');
  intro.style.display = 'none';
}

function startFlat(lock = true) {
  if (started) return;
  started = true;
  hideIntro();
  audio.start();
  game.start('flat');
  if (lock && canvas.requestPointerLock) {
    try {
      canvas.requestPointerLock();
    } catch {}
  }
}

btnFlat?.addEventListener('click', () => startFlat(true));

async function enterVR() {
  if (!navigator.xr) {
    hud.toast('Este navegador no soporta WebXR. Prueba el navegador de Pico 4.', 'err');
    return;
  }
  audio.start();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
    });
    session.addEventListener('end', () => {
      player.setXR(false);
      hud.setXR(false);
      hud.toast('Sesión VR finalizada. Sigues en modo pantalla.', '');
    });
    renderer.xr.setSession(session);
    renderer.xr.setFoveation?.(0.65);
  } catch (err) {
    console.error(err);
    vrNote.textContent =
      'No se pudo iniciar la sesión VR. Abre la página en el navegador del Pico 4 con HTTPS y acepta el permiso.';
    vrNote.classList.add('warn');
  }
}

btnVR?.addEventListener('click', enterVR);

renderer.xr.addEventListener('sessionstart', () => {
  hideIntro();
  started = true;
  audio.start();
  player.setXR(true);
  hud.setXR(true);
  game.start('xr');
  renderer.xr.setFoveation?.(0.65);
  // la pose de la cabeza llega en el primer frame XR: damos margen antes de situar el panel
  setTimeout(() => {
    if (!game.state.welcomeShown) {
      game.state.welcomeShown = true;
      hud.showWelcome();
    }
  }, 900);
});

if (navigator.xr?.isSessionSupported) {
  navigator.xr
    .isSessionSupported('immersive-vr')
    .then((ok) => {
      if (!ok) {
        btnVR.classList.remove('primary');
        btnVR.setAttribute('aria-disabled', 'true');
        vrNote.textContent =
          'Este navegador no detecta un visor compatible. Abre la página en el navegador del Pico 4 (WebXR) o juega en pantalla.';
        vrNote.classList.add('warn');
      }
    })
    .catch(() => {});
}

btnRestart?.addEventListener('click', () => {
  game.reset();
  hud.hideResults();
});
btnCloseResults?.addEventListener('click', () => hud.hideResults());

/* ------------------------------------------------------------ bucle de render */
const clock = { last: performance.now() / 1000, elapsed: 0 };
let firstFrame = true;

renderer.setAnimationLoop(() => {
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - clock.last);
  clock.last = now;
  clock.elapsed += dt;
  const t = clock.elapsed;

  if (!started) {
    // cámara de presentación orbitando la casa
    const ang = t * 0.06 + 0.6;
    const r = 15.5;
    const x = Math.sin(ang) * r;
    const z = Math.cos(ang) * r + 1;
    player.rig.position.set(x, 3.1, z);
    player.rig.rotation.y = Math.atan2(x, z);
    player.camera.rotation.x = -0.09;
  }

  player.update(dt);
  game.update(dt);
  solar.update(dt);
  ppe.update(dt);
  interactions.update(dt);
  world.update(dt, t);
  hud.update(dt);

  renderer.render(scene, player.camera);

  if (firstFrame) {
    firstFrame = false;
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
    applyDebugParams();
  }
});

function applyDebugParams() {
  if (!params.has('skipintro')) return;
  if (!started) startFlat(false);
  const noHud = params.has('nohud');
  if (noHud) document.getElementById('hud').classList.add('hidden');

  const phase = params.get('phase');
  if (phase === 'install' || phase === 'roof') {
    game.equipAll();
    if (phase === 'roof') game.goTo(0.4, 2.35, 0);
    else game.goTo(0.15, 5.2, 0);
  }
  const panels = Number(params.get('panels') || 0);
  if (panels > 0) {
    game.equipAll();
    if (phase === 'roof') game.goTo(0.4, 2.35, 0);
    else game.goTo(0.15, 5.2, 0);
    game.debugPlace(panels);
  }

  const view = params.get('view');
  player.state.eye = 1.66;
  if (view === 'roof') {
    game.equipAll();
    game.goTo(0.4, 3.3, 0);
    player.camera.rotation.x = -0.3;
  } else if (view === 'platform') {
    game.equipAll();
    game.goTo(0.15, 5.2, 0);
    player.camera.rotation.x = -0.28;
    game.debugPlace(10);
  } else if (view === 'bench') {
    game.goTo(3.3, 8.7, -0.62);
    player.camera.rotation.x = -0.3;
  } else if (view === 'front') {
    game.goTo(2.5, 12.5, 0.28);
    player.camera.rotation.x = -0.05;
    game.equipAll();
    game.debugPlace(8);
  } else if (view === 'side') {
    game.goTo(-9.5, 6.5, 1.1);
    player.camera.rotation.x = -0.12;
    game.equipAll();
    game.debugPlace(9);
  } else if (view === 'drone') {
    game.equipAll();
    if (!panels) game.debugPlace(9);
    const px = 11;
    const pz = 13;
    player.state.eye = 9;
    game.goTo(px, pz, Math.atan2(px, pz));
    player.camera.rotation.x = Math.atan2(3.2 - 9, Math.hypot(px, pz));
  } else if (view === 'board') {
    game.equipAll();
    game.goTo(0.2, 5.2, Math.PI / 2);
    player.camera.rotation.x = -0.03;
    game.debugPlace(9);
  } else if (view === 'results') {
    game.equipAll();
    game.goTo(0.2, 5.2, 0);
    game.debugPlace(11);
    setTimeout(() => game.finish(), 500);
  }
}

window.addEventListener('resize', () => {
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});
