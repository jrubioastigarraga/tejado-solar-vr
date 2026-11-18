import * as THREE from 'three';
import { ENERGY, PANEL, SITE } from './config.js';

export function createGame({ player, solar, ppe, hud, world, interactions, audio }) {
  const state = {
    phase: 'epi',
    started: false,
    xr: false,
    welcomeShown: false,
  };

  window.__sfx = audio;

  /* ---------------------------------------------------------- línea de vida */
  const lifeline = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0xffc247, roughness: 0.55, metalness: 0.3 }),
  );
  lifeline.visible = false;
  lifeline.castShadow = true;
  world.group.add(lifeline);

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  function updateLifeline() {
    const active = ppe.equipped.harness && player.onRoof();
    lifeline.visible = active;
    if (!active) return;
    _a.copy(world.safetyAnchor);
    player.camera.getWorldPosition(_b);
    _b.y -= 0.42;
    _dir.subVectors(_b, _a);
    const len = _dir.length();
    lifeline.position.copy(_a).addScaledVector(_dir, 0.5);
    lifeline.scale.set(1, len, 1);
    lifeline.quaternion.setFromUnitVectors(_up, _dir.normalize());
  }

  const phaseInfo = {
    epi: {
      name: 'FASE 1 · SEGURIDAD',
      objective: 'Coge casco, gafas, guantes y arnés de la mesa de EPI y póntelos.',
    },
    install: {
      name: 'FASE 2 · MONTAJE',
      objective: 'Coge un panel del stock y acércalo a una guía del faldón sur. Suelta cuando se ponga verde.',
    },
    done: {
      name: 'OBRA CERTIFICADA',
      objective: 'Instalación revisada. Consulta el certificado en el cuadro de obra.',
    },
  };

  function sync() {
    hud.setState({
      placed: solar.state.placed,
      kwp: solar.state.kwp,
      kwh: solar.state.annualKwh,
      shadeAvg: solar.state.shadeAvg,
      available: solar.state.available,
      validSlots: solar.validSlots,
      ppe: { ...ppe.equipped },
      phase: state.phase,
    });
    const kw = solar.state.kwp.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    world.setLcd(
      [`${kw} kWp`, `${solar.state.annualKwh.toLocaleString('es-ES')} kWh/año`],
      solar.state.placed ? '#46d99b' : '#6f8d7f',
    );
  }

  let lastObjective = '';
  function updateObjective() {
    let objective = phaseInfo[state.phase].objective;
    if (state.phase === 'epi') {
      if (ppe.isComplete()) {
        objective = 'EPI completo. Pulsa el pulsador verde junto a la escalera para subir a cubierta.';
      }
    } else if (state.phase === 'install') {
      if (solar.state.placed >= solar.validSlots) {
        objective = 'Todos los huecos útiles cubiertos. Baja al andamio y certifica la instalación.';
      } else if (solar.state.placed >= ENERGY.minPanels) {
        objective = 'Mínimo alcanzado. Puedes certificar en el cuadro del andamio o seguir montando.';
      }
    }
    if (objective !== lastObjective) {
      lastObjective = objective;
      hud.setPhase(state.phase, phaseInfo[state.phase].name, objective);
    }
  }

  function refreshAll() {
    sync();
    updateObjective();
  }

  /* --------------------------------------------------------------- objetos */
  for (const panel of solar.panels) {
    interactions.registerGrab(panel, {
      type: 'panel',
      maxDistance: 3.1,
      hoverScale: 1,
      onGrab: (root) => {
        if (!root.userData.canGrab) return false;
        return solar.beginHold(root);
      },
      onRelease: (root) => solar.release(root),
    });
  }

  for (const item of ppe.entries) {
    interactions.registerGrab(item, {
      type: 'ppe',
      maxDistance: 3.0,
      hoverScale: 1.06,
      onGrab: (root, holder) => ppe.grab(root, holder),
      onRelease: (root) => ppe.drop(root),
    });
  }

  interactions.registerButton(
    world.accessPedestal,
    () => accessRoof(),
    { maxDistance: 4.2, hoverScale: 1 },
  );

  interactions.registerButton(
    world.finishConsole,
    () => finish(),
    { maxDistance: 4.0, hoverScale: 1 },
  );

  interactions.registerButton(
    hud.modalButton,
    () => hud.modalButton.userData.onClick?.(),
    {
      maxDistance: 3.4,
      hoverScale: 1.03,
      enabled: () => !!hud.state.modalOpen,
    },
  );

  /* --------------------------------------------------------------- acciones */
  function accessRoof() {
    if (!ppe.isComplete()) {
      hud.toast('Primero completa el EPI: casco, gafas, guantes y arnés.', 'err');
      audio.error();
      return;
    }
    if (state.phase === 'install' && player.onRoof()) {
      hud.toast('Ya estás en la cubierta.', '');
      return;
    }
    state.phase = 'install';
    lastObjective = '';
    player.teleport(0.15, 5.2, 0);
    refreshAll();
    audio.success();
    hud.toast('Acceso autorizado. Revisa el plan de obra y empieza el montaje.', 'ok');
  }

  function computeResult() {
    const placed = solar.state.placed;
    const valid = solar.validSlots;
    const shade = solar.state.shadeAvg;
    const ppeCount = ppe.count();

    const safety = ppeCount * 5 + (ppe.isComplete() ? 5 : 0); // 25
    const mounting = Math.min(placed / valid, 1) * 40;
    const performance = (placed ? shade : 0) * 25;
    const finishBonus = placed >= valid ? 10 : placed >= ENERGY.minPanels ? 5 : 0;
    const total = Math.round(safety + mounting + performance + finishBonus);
    const stars = total >= 88 ? 5 : total >= 74 ? 4 : total >= 58 ? 3 : total >= 40 ? 2 : 1;

    const kwp = placed * (PANEL.watts / 1000);
    const kwh = solar.state.annualKwh;
    const money = Math.round(kwh * ENERGY.pricePerKwh);
    const co2 = Math.round(kwh * ENERGY.co2PerKwh);

    const titles = {
      5: 'Instalación ejemplar',
      4: 'Muy buena instalación',
      3: 'Instalación correcta',
      2: 'Instalación mejorable',
      1: 'Revisa la instalación',
    };

    let note = 'Has evitado la sombra del árbol: los paneles producen a pleno rendimiento.';
    if (shade < 0.9) {
      note = 'Parte de los paneles están bajo la sombra del árbol: producen hasta un 50 % menos.';
    }
    if (placed < ENERGY.minPanels) {
      note = `Solo ${placed} paneles: la instalación no llega al mínimo de ${ENERGY.minPanels} para certificar.`;
    }

    return {
      title: titles[stars],
      total,
      stars,
      kwp: kwp.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      kwh: kwh.toLocaleString('es-ES'),
      money: money.toLocaleString('es-ES'),
      co2: co2.toLocaleString('es-ES'),
      note,
      breakdown: [
        { label: 'Seguridad y EPI', value: `${Math.round(safety)} / 25` },
        { label: `Montaje (${placed}/${valid} paneles)`, value: `${Math.round(mounting)} / 40` },
        {
          label: `Rendimiento (sombra media ${Math.round((1 - shade) * 100)}%)`,
          value: `${Math.round(performance)} / 25`,
        },
        { label: 'Certificación y remate', value: `${finishBonus} / 10` },
      ],
      onRestart: () => reset(),
    };
  }

  function finish() {
    if (state.phase === 'epi' && !player.onRoof()) {
      hud.toast('Sube primero a la cubierta para certificar la instalación.', 'err');
      audio.error();
      return;
    }
    if (solar.state.placed < ENERGY.minPanels) {
      hud.toast(
        `Faltan paneles: ${solar.state.placed}/${ENERGY.minPanels} mínimo para certificar.`,
        'err',
      );
      audio.error();
      return;
    }
    state.phase = 'done';
    lastObjective = '';
    refreshAll();
    const result = computeResult();
    hud.showResults(result);
    audio.success();
    hud.toast('Instalación certificada. ¡Buen trabajo!', 'ok');
  }

  function reset() {
    solar.reset();
    ppe.reset();
    state.phase = 'epi';
    lastObjective = '';
    player.teleport(SITE.start.x, SITE.start.z, 0);
    hud.hideResults();
    hud.hideModal();
    hud.setState({ target: null });
    refreshAll();
    hud.toast('Nueva instalación. Empieza por el EPI.', '');
  }

  function start(mode = 'flat') {
    state.xr = mode === 'xr';
    if (!state.started) {
      state.started = true;
      player.teleport(SITE.start.x, SITE.start.z, 0);
      refreshAll();
      hud.hideResults();
    }
    hud.setXR(mode === 'xr');
    refreshAll();
  }

  /* ------------------------------------------------------------ callbacks */
  player.onAction = () => {
    ppe.equipHeld();
  };

  player.onActivate = () => {
    const entry = interactions.hovered();
    if (!entry) return;
    if (entry.type === 'ppe') {
      ppe.equipDirect(entry.root);
    } else if (entry.type === 'button') {
      entry.onClick?.();
    }
  };

  world.accessButton.userData.interactive = true;

  // estados iniciales
  state.phase = 'epi';
  refreshAll();

  const api = {
    state,
    solar,
    ppe,
    hud,
    player,
    world,
    interactions,
    start,
    update: updateLifeline,
    accessRoof,
    finish,
    reset,
    computeResult,
    refreshAll,
    equipAll() {
      for (const id of ['helmet', 'goggles', 'gloves', 'harness']) {
        ppe.equipDirect(ppe.items[id]);
      }
      refreshAll();
    },
    debugPlace(n) {
      solar.debugPlace(n);
      refreshAll();
    },
    goTo(x, z, yaw = 0) {
      player.teleport(x, z, yaw);
      if (player.groundHeightAt(x, z) > 2) {
        state.phase = 'install';
        lastObjective = '';
      }
      refreshAll();
    },
  };

  return api;
}
