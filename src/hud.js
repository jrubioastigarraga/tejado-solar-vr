import * as THREE from 'three';
import { ENERGY, PANEL } from './config.js';
import { makeLabelTexture } from './textures.js';
import { makeScreen, fitText, wrapLines } from './screen.js';

function el(id) {
  return document.getElementById(id);
}

function fmt(n, dec = 0) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function createHUD({ camera, player, world, scene }) {
  const dom = {
    hud: el('hud'),
    phase: el('phase-name'),
    objective: el('objective'),
    panels: el('stat-panels'),
    kwp: el('stat-kwp'),
    kwh: el('stat-kwh'),
    toast: el('toast'),
    hint: el('hint'),
    results: el('results'),
    resTotal: el('res-total'),
    resTitle: el('results-title'),
    resStars: el('results-stars'),
    resKwp: el('res-kwp'),
    resKwh: el('res-kwh'),
    resMoney: el('res-money'),
    resCo2: el('res-co2'),
    resBreakdown: el('res-breakdown'),
    resNote: el('res-note'),
  };
  const chips = {};
  document.querySelectorAll('#ppe-chips .chip').forEach((c) => {
    chips[c.dataset.ppe] = c;
  });

  const state = {
    xr: false,
    phase: 'epi',
    phaseName: 'FASE 1 · SEGURIDAD',
    objective: 'Ponte el EPI antes de subir a cubierta.',
    placed: 0,
    validSlots: 13,
    kwp: 0,
    kwh: 0,
    shadeAvg: 1,
    available: 16,
    target: null,
    ppe: { helmet: false, goggles: false, gloves: false, harness: false },
  };

  /* ---------------------------------------------------------------- TOAST 3D */
  const toastScreen = makeScreen(0.92, 0.24, { px: 768, py: 200 });
  toastScreen.mesh.visible = false;
  scene.add(toastScreen.mesh);
  let toastTimer = 0;

  let domToastTimer = null;

  /* -------------------------------------------------------------- MODAL VR */
  const modal = new THREE.Group();
  const modalScreen = makeScreen(1.5, 0.92, { px: 1280, py: 780 });
  modal.add(modalScreen.mesh);

  const modalBtn = new THREE.Group();
  const modalBtnMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.17, 0.045),
    new THREE.MeshStandardMaterial({
      color: 0xffb52e,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.1,
    }),
  );
  modalBtn.add(modalBtnMesh);
  const modalBtnLabel = makeScreen(0.78, 0.11, { px: 640, py: 140 });
  modalBtnLabel.mesh.position.z = 0.028;
  modalBtn.add(modalBtnLabel.mesh);
  modalBtn.position.set(0, -0.58, 0.05);
  modal.add(modalBtn);
  modal.visible = false;
  scene.add(modal);

  let modalAction = null;

  function drawModalButton(text) {
    modalBtnLabel.draw((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#20160a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 62px Inter, Arial, sans-serif';
      ctx.fillText(text, w / 2, h / 2 + 4);
    });
  }
  drawModalButton('EMPEZAR');

  modalBtn.userData.hudButton = true;

  function showModal({ title, lines = [], button = 'CONTINUAR', action = null, subtitle = '' }) {
    modalAction = action;
    modalScreen.draw((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(14,27,43,0.98)');
      g.addColorStop(1, 'rgba(7,13,22,0.98)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 30);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,194,71,0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(6, 6, w - 12, h - 12, 26);
      ctx.stroke();

      ctx.fillStyle = '#ffc247';
      ctx.font = '700 24px Inter, Arial, sans-serif';
      ctx.fillText('SOLARIS · TEJADO SOLAR VR', 52, 62);

      ctx.fillStyle = '#ffffff';
      const ts = fitText(ctx, title, w - 104, 62, 800);
      ctx.font = `800 ${ts}px Inter, Arial, sans-serif`;
      ctx.fillText(title, 52, 126);

      if (subtitle) {
        ctx.fillStyle = '#9fb4c8';
        ctx.font = '500 25px Inter, Arial, sans-serif';
        ctx.fillText(subtitle, 52, 166);
      }

      let y = subtitle ? 222 : 200;
      ctx.textAlign = 'left';
      for (const line of lines) {
        ctx.font = '500 27px Inter, Arial, sans-serif';
        ctx.fillStyle = line.color || '#c9d8e8';
        const wrapped = wrapLines(ctx, line.text ?? line, w - 104);
        for (const l of wrapped) {
          ctx.fillText(l, 52, y);
          y += 36;
        }
        y += line.gap || 6;
      }
    });
    drawModalButton(button);
    modalBtn.visible = true;

    const camPos = camera.getWorldPosition(new THREE.Vector3());
    const dir = camera.getWorldDirection(new THREE.Vector3());
    dir.y = 0;
    dir.normalize();
    modal.position.copy(camPos).addScaledVector(dir, 1.75);
    modal.position.y = camPos.y - 0.1;
    modal.lookAt(camPos.x, modal.position.y, camPos.z);
    modal.visible = true;
    state.modalOpen = true;
  }

  function hideModal() {
    modal.visible = false;
    state.modalOpen = false;
  }

  modalBtn.userData.onClick = () => {
    const action = modalAction;
    hideModal();
    action?.();
  };

  /* -------------------------------------------------------------- PANEL MUÑECA */
  const wrist = makeScreen(0.32, 0.18, { px: 640, py: 360 });
  const left = player.controllers[0];
  wrist.mesh.position.set(0, 0.085, -0.3);
  wrist.mesh.rotation.x = -0.62;
  wrist.mesh.rotation.z = 0.06;
  wrist.mesh.visible = false;
  left.controller.add(wrist.mesh);

  const boardScreen = world.board.screen;

  /* --------------------------------------------------------------- RENDER */
  function drawWrist() {
    if (!state.xr) return;
    wrist.draw((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(10,19,31,0.95)');
      g.addColorStop(1, 'rgba(6,12,20,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,194,71,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 22);
      ctx.stroke();

      ctx.fillStyle = '#ffc247';
      ctx.font = '700 22px Inter, Arial, sans-serif';
      ctx.fillText('INSTALACIÓN FV', 24, 42);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 58px Inter, Arial, sans-serif';
      ctx.fillText(`${state.placed}`, 24, 108);
      ctx.fillStyle = '#8ea4bb';
      ctx.font = '600 26px Inter, Arial, sans-serif';
      ctx.fillText(`/ ${state.validSlots} paneles`, 78, 106);

      ctx.fillStyle = '#cfe0ef';
      ctx.font = '600 24px Inter, Arial, sans-serif';
      ctx.fillText(`${fmt(state.kwp, 2)} kWp · ${fmt(state.kwh)} kWh/año`, 24, 146);

      const ppeNames = [
        ['helmet', 'C'],
        ['goggles', 'G'],
        ['gloves', 'U'],
        ['harness', 'A'],
      ];
      let x = 24;
      ctx.font = '700 22px Inter, Arial, sans-serif';
      for (const [key, letter] of ppeNames) {
        const on = state.ppe[key];
        ctx.fillStyle = on ? '#46d99b' : '#44576b';
        ctx.beginPath();
        ctx.roundRect(x, 168, 34, 30, 8);
        ctx.fill();
        ctx.fillStyle = on ? '#062019' : '#8fa3b6';
        ctx.fillText(letter, x + 10, 191);
        x += 42;
      }
      ctx.fillStyle = state.shadeAvg > 0.85 ? '#46d99b' : '#ffb347';
      ctx.font = '600 22px Inter, Arial, sans-serif';
      ctx.fillText(`sombras ${Math.round(state.shadeAvg * 100)}%`, 210, 191);

      if (state.target) {
        ctx.fillStyle = 'rgba(70,217,155,0.12)';
        ctx.beginPath();
        ctx.roundRect(16, 214, w - 32, 118, 14);
        ctx.fill();
        ctx.fillStyle = '#8df7cf';
        ctx.font = '700 22px Inter, Arial, sans-serif';
        ctx.fillText('guía seleccionada', 30, 246);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 25px Inter, Arial, sans-serif';
        const kwh = (PANEL.watts / 1000) * ENERGY.yieldPerKwp * state.target.shade;
        ctx.fillText(
          `sombra ${Math.round((1 - state.target.shade) * 100)}% · ${Math.round(kwh)} kWh/año`,
          30,
          282,
        );
        ctx.fillStyle = '#9fe8cd';
        ctx.font = '600 21px Inter, Arial, sans-serif';
        ctx.fillText('suelta el gatillo para fijar', 30, 314);
      } else {
        ctx.fillStyle = '#7e93a8';
        ctx.font = '500 23px Inter, Arial, sans-serif';
        ctx.fillText('acerca un panel a una guía', 24, 258);
        ctx.fillText('para ver su producción', 24, 292);
      }
    });
  }

  function drawBoard() {
    const s = state;
    boardScreen.draw((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0d1a29');
      g.addColorStop(1, '#070f19');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ffc247';
      ctx.fillRect(0, 0, w, 8);
      ctx.font = '700 26px Inter, Arial, sans-serif';
      ctx.fillStyle = '#ffc247';
      ctx.fillText('SOLARIS · PLAN DE INSTALACIÓN', 48, 62);
      ctx.fillStyle = '#7f95aa';
      ctx.font = '500 20px Inter, Arial, sans-serif';
      ctx.fillText(`Cubierta sur · ${PANEL.watts} Wp · ${PANEL.width} × ${PANEL.height} m`, 48, 92);

      const steps = [
        {
          n: '1',
          text: 'Equipo de protección individual',
          done: s.ppe.helmet && s.ppe.goggles && s.ppe.gloves && s.ppe.harness,
          info: `${['helmet', 'goggles', 'gloves', 'harness'].filter((k) => s.ppe[k]).length}/4`,
        },
        { n: '2', text: 'Acceso a cubierta y línea de vida', done: s.phase !== 'epi', info: '' },
        {
          n: '3',
          text: 'Montaje de paneles sobre guías',
          done: s.placed >= 8,
          info: `${s.placed}/${s.validSlots}`,
        },
        { n: '4', text: 'Certificar la instalación', done: s.phase === 'done', info: '' },
      ];

      let y = 150;
      for (const step of steps) {
        ctx.fillStyle = step.done ? 'rgba(70,217,155,0.14)' : 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.roundRect(40, y, w - 80, 62, 12);
        ctx.fill();
        ctx.strokeStyle = step.done ? 'rgba(70,217,155,0.5)' : 'rgba(130,155,180,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(40, y, w - 80, 62, 12);
        ctx.stroke();
        ctx.fillStyle = step.done ? '#46d99b' : '#65798d';
        ctx.font = '800 26px Inter, Arial, sans-serif';
        ctx.fillText(step.done ? '✓' : step.n, 60, y + 41);
        ctx.fillStyle = step.done ? '#d9fff0' : '#c4d5e6';
        ctx.font = '600 24px Inter, Arial, sans-serif';
        ctx.fillText(step.text, 104, y + 40);
        ctx.fillStyle = '#8ea4b9';
        ctx.textAlign = 'right';
        ctx.fillText(step.info, w - 62, y + 40);
        ctx.textAlign = 'left';
        y += 72;
      }

      ctx.fillStyle = '#0a1522';
      ctx.beginPath();
      ctx.roundRect(40, h - 176, w - 80, 124, 14);
      ctx.fill();
      ctx.fillStyle = '#ffc247';
      ctx.font = '700 30px Inter, Arial, sans-serif';
      ctx.fillText(`${s.placed} paneles · ${fmt(s.kwp, 2)} kWp`, 64, h - 122);
      ctx.fillStyle = '#e8f3ff';
      ctx.font = '600 28px Inter, Arial, sans-serif';
      ctx.fillText(`${fmt(s.kwh)} kWh/año estimados`, 64, h - 78);
      ctx.fillStyle = '#93a9bd';
      ctx.font = '500 21px Inter, Arial, sans-serif';
      ctx.fillText(
        `sombra media ${Math.round(s.shadeAvg * 100)}% · stock ${s.available} paneles`,
        64,
        h - 46,
      );
    });
  }

  function refreshDom() {
    dom.panels.textContent = String(state.placed);
    dom.kwp.textContent = fmt(state.kwp, 2);
    dom.kwh.textContent = fmt(state.kwh);
    dom.phase.textContent = state.phaseName;
    dom.objective.textContent = state.objective;
    for (const [key, chip] of Object.entries(chips)) {
      chip.classList.toggle('on', !!state.ppe[key]);
    }
    dom.objective.parentElement && dom.objective.parentElement.classList.toggle('done', state.phase === 'done');
  }

  let lastKey = '';
  let boardKey = '';
  function refresh(force = false) {
    const key = `${state.placed}|${state.kwp}|${state.kwh}|${JSON.stringify(state.ppe)}|${state.phase}|${state.target?.index ?? ''}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    refreshDom();
    drawWrist();
    const bkey = `${state.phase}|${state.placed}|${state.kwp}|${state.kwh}|${state.available}|${JSON.stringify(state.ppe)}`;
    if (force || bkey !== boardKey) {
      boardKey = bkey;
      drawBoard();
    }
  }

  function toast(text, type = '') {
    if (state.xr) {
      toastTimer = 3.6;
      toastScreen.mesh.visible = true;
      toastScreen.mesh.material.opacity = 1;
      const camPos = camera.getWorldPosition(new THREE.Vector3());
      const dir = camera.getWorldDirection(new THREE.Vector3());
      dir.y = 0;
      dir.normalize();
      toastScreen.mesh.position.copy(camPos).addScaledVector(dir, 1.35);
      toastScreen.mesh.position.y = camPos.y - 0.26;
      toastScreen.mesh.lookAt(camPos.x, toastScreen.mesh.position.y, camPos.z);
      toastScreen.mesh.rotation.z = 0;

      const color = type === 'err' ? '#ff9b9b' : type === 'ok' ? '#9ff5d0' : '#ffe2a8';
      const border =
        type === 'err' ? 'rgba(255,107,107,0.7)' : type === 'ok' ? 'rgba(70,217,155,0.7)' : 'rgba(255,194,71,0.6)';
      toastScreen.draw((ctx, w, h) => {
        ctx.fillStyle = 'rgba(8,15,25,0.94)';
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 30);
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(3, 3, w - 6, h - 6, 27);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const size = fitText(ctx, text, w - 50, 34, 600);
        ctx.font = `600 ${size}px Inter, Arial, sans-serif`;
        ctx.fillText(text, w / 2, h / 2 + 2);
      });
    } else {
      dom.toast.textContent = text;
      dom.toast.className = `show ${type}`;
      clearTimeout(domToastTimer);
      domToastTimer = setTimeout(() => {
        dom.toast.className = '';
      }, 3600);
    }
  }

  function setPhase(name, phaseName, objective) {
    state.phase = name;
    if (phaseName) state.phaseName = phaseName;
    if (objective) state.objective = objective;
    refresh(true);
  }

  function setState(partial) {
    Object.assign(state, partial);
    refresh();
  }

  function setXR(on) {
    state.xr = on;
    wrist.mesh.visible = on;
    modal.visible = false;
    if (!on) toastScreen.mesh.visible = false;
    dom.hud.classList.toggle('hidden', on);
    refresh(true);
  }

  function showWelcome() {
    showModal({
      title: 'Bienvenido a la obra',
      subtitle: 'Instalación fotovoltaica · vivienda unifamiliar',
      lines: [
        { text: '1. Ponte el EPI de la mesa: casco, gafas, guantes y arnés.', color: '#e8f3ff' },
        { text: '2. Sube a cubierta con la línea de vida. El faldón sur tiene 15 huecos, 2 los ocupa la chimenea.', color: '#c9d8e8' },
        { text: '3. Coge paneles del stock y acércalos a las guías. Evita el árbol: da sombra.', color: '#c9d8e8' },
        { text: 'Con 8 paneles ya puedes certificar. Cuantos más y menos sombra, mejor nota.', color: '#ffc247' },
      ],
      button: 'EMPEZAR',
      action: null,
    });
  }

  function stars(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function showResults(result) {
    if (state.xr) {
      showModal({
        title: result.title,
        subtitle: `${result.total}/100 puntos · ${stars(result.stars)}`,
        lines: [
          { text: `${result.kwp} kWp instalados · ${result.kwh} kWh/año`, color: '#ffc247' },
          { text: `${result.money} €/año de ahorro · ${result.co2} kg CO₂/año evitados`, color: '#c9d8e8' },
          ...result.breakdown.map((b) => ({
            text: `${b.label}: ${b.value}`,
            color: '#9fb4c8',
            gap: 2,
          })),
          { text: result.note, color: '#8df7cf', gap: 0 },
        ],
        button: 'REINICIAR',
        action: result.onRestart,
      });
      return;
    }

    dom.resTotal.textContent = String(result.total);
    dom.resTitle.textContent = result.title;
    dom.resStars.textContent = stars(result.stars);
    dom.resKwp.textContent = result.kwp;
    dom.resKwh.textContent = result.kwh;
    dom.resMoney.textContent = result.money;
    dom.resCo2.textContent = result.co2;
    dom.resBreakdown.innerHTML = result.breakdown
      .map((b) => `<li><span>${b.label}</span><b>${b.value}</b></li>`)
      .join('');
    dom.resNote.textContent = result.note;
    dom.results.classList.remove('hidden');
  }

  function hideResults() {
    dom.results.classList.add('hidden');
  }

  function update(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer < 0.8) {
        toastScreen.mesh.material.opacity = Math.max(0, toastTimer / 0.8);
      }
      if (toastTimer <= 0) toastScreen.mesh.visible = false;
    }
  }

  drawBoard();
  refresh(true);

  return {
    state,
    modal,
    modalButton: modalBtn,
    toastScreen,
    setState,
    setPhase,
    setXR,
    toast,
    update,
    showWelcome,
    showResults,
    hideResults,
    hideModal,
    showModal,
    refresh,
    drawBoard,
  };
}
