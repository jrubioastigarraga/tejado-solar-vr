import * as THREE from 'three';
import { ENERGY, PANEL, SITE } from './config.js';

export function createGame({
  scene,
  player,
  solar,
  ppe,
  hud,
  world,
  interactions,
  audio,
  electrical,
}) {
  const state = {
    phase: 'epi',
    started: false,
    xr: false,
    welcomeShown: false,
    coffee: { triggered: false, ordered: false, done: false },
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
  const _brushPos = new THREE.Vector3();
  const _panelPos = new THREE.Vector3();

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

  /* ------------------------------------------------------ cepillo de limpieza */
  function updateCleaning(dt) {
    const brush = world.brush;
    if (brush.userData.state !== 'held') return;
    brush.getWorldPosition(_brushPos);
    for (const panel of solar.dustyPanels()) {
      panel.getWorldPosition(_panelPos);
      if (_brushPos.distanceTo(_panelPos) > 0.82) continue;
      panel.userData.cleanT = (panel.userData.cleanT || 0) + dt;
      if (panel.userData.cleanT >= 0.3) {
        panel.userData.cleanT = 0;
        solar.cleanPanel(panel);
      }
      break;
    }
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
    coffee: {
      name: 'DESCANSO · CAFÉ',
      objective: 'Se te ha retirado el arnés. Baja por la escalera y pide un café en la máquina, junto a la mesa de EPI.',
    },
    connection: {
      name: 'FASE 3 · CONEXIÓN',
      objective: 'Conecta el cable DC y la puesta a tierra en el cuadro eléctrico del andamio.',
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
      efficiency: solar.state.efficiency,
      dusty: solar.state.dusty,
      available: solar.state.available,
      validSlots: solar.validSlots,
      ppe: { ...ppe.equipped },
      phase: state.phase,
      wired: electrical.state.wired,
      grounded: electrical.state.grounded,
      powered: electrical.state.on,
    });
    const kw = solar.state.kwp.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const instant = electrical.state.instantKw.toLocaleString('es-ES', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    let footer = 'sin conexión';
    if (electrical.state.on) footer = `EN MARCHA · ${instant} kW`;
    else if (electrical.state.wired || electrical.state.grounded) footer = 'conexión parcial';
    world.setLcd(
      [`${kw} kWp`, `${solar.state.annualKwh.toLocaleString('es-ES')} kWh/año`],
      solar.state.placed ? '#46d99b' : '#6f8d7f',
      footer,
    );
  }

  function advancePhase() {
    if (state.phase !== 'install') return;
    if (solar.state.placed < ENERGY.minPanels) return;
    state.phase = 'connection';
    lastObjective = '';
    audio.success();
    hud.toast('Montaje suficiente. Ahora conecta y pon en marcha la instalación.', 'ok');
  }

  /* -------------------------------------------------- pausa del café (reto) */
  function startCoffeeBreak() {
    if (state.coffee.triggered) return;
    state.coffee.triggered = true;
    state.phase = 'coffee';
    lastObjective = '';
    ppe.unequip('harness');
    refreshAll();
    audio.error();
    hud.showModal({
      title: 'HORA DEL CAFÉ',
      subtitle: 'Descanso obligatorio tras los dos primeros paneles',
      lines: [
        { text: 'Te has quitado el arnés: no puedes seguir en cubierta sin él.', color: '#ffb3b3' },
        { text: 'Pulsa el botón rojo para bajar por la escalera.', color: '#ffe7b3' },
        { text: 'Ve a la máquina de café, junto a la mesa de EPI, y pide un café.', color: '#c9d8e8' },
      ],
      button: 'ENTENDIDO',
    });
  }

  function onPanelPlaced() {
    if (state.coffee.triggered || state.phase === 'coffee') return;
    if (solar.state.placed >= 2) startCoffeeBreak();
  }

  function descend() {
    if (!player.onRoof()) {
      hud.toast('Ya estás en la zona de descanso.', '');
      return;
    }
    player.teleport(6.3, 8.1, -0.7);
    hud.toast('Has bajado. La máquina de café está justo delante de ti.', '');
    audio.pick();
    refreshAll();
  }

  function orderCoffee() {
    if (state.phase !== 'coffee') {
      hud.toast('Ahora mismo no toca café. El descanso llega al colocar el segundo panel.', '');
      return;
    }
    if (state.coffee.ordered) {
      hud.toast('Ya has pedido el café: coge la taza y llévala a la boca.', '');
      return;
    }
    state.coffee.ordered = true;
    world.coffeeCup.visible = true;
    hud.toast('Café servido. Coge la taza y acércala a la boca para beberlo.', 'ok');
    audio.success();
    refreshAll();
  }

  function drinkCoffee() {
    if (state.coffee.done) return;
    state.coffee.done = true;
    const cup = world.coffeeCup;
    cup.userData.drunk = true;
    cup.visible = false;
    interactions.releaseHeld(cup);
    if (cup.parent) scene.attach(cup);
    state.phase = 'install';
    lastObjective = '';
    refreshAll();
    audio.success();
    hud.showModal({
      title: 'CAFÉ SERVIDO',
      subtitle: 'Descanso completado',
      lines: [
        { text: 'Recoge el arnés de la mesa de EPI y ponételo otra vez.', color: '#ffe7b3' },
        { text: 'Sin arnés el pulsador verde no te dejará subir a cubierta.', color: '#c9d8e8' },
      ],
      button: 'SEGUIR TRABAJANDO',
    });
    hud.toast('Descanso terminado: ponte el arnés y vuelve a subir.', 'ok');
  }

  let lastObjective = '';
  function updateObjective() {
    let objective = phaseInfo[state.phase].objective;
    if (state.phase === 'epi') {
      if (ppe.isComplete()) {
        objective = 'EPI completo. Pulsa el pulsador verde junto a la escalera para subir a cubierta.';
      }
    } else if (state.phase === 'install') {
      if (state.coffee.triggered && !ppe.equipped.harness) {
        objective = 'Descanso terminado: recoge el arnés de la mesa de EPI, póntelo y pulsa el pulsador verde para subir.';
      } else if (solar.state.placed >= solar.validSlots) {
        objective = 'Todos los huecos útiles cubiertos. Prepara la conexión eléctrica.';
      } else if (solar.state.placed >= ENERGY.minPanels) {
        objective = 'Mínimo alcanzado. Puedes seguir montando o pasar a la conexión.';
      } else if (solar.state.dusty > 0) {
        objective = `Coge el cepillo del andamio y limpia los ${solar.state.dusty} paneles con polvo.`;
      }
    } else if (state.phase === 'connection') {
      if (solar.state.placed < ENERGY.minPanels) {
        objective = `Faltan paneles (${solar.state.placed}/${ENERGY.minPanels}): vuelve a montar para poder certificar.`;
      } else if (solar.state.dusty > 0) {
        objective = `Quedan ${solar.state.dusty} paneles con polvo. Cepíllalos para recuperar rendimiento.`;
      } else if (!electrical.state.wired) {
        objective = 'Conecta el cable DC de la bobina a la toma roja del cuadro eléctrico.';
      } else if (!electrical.state.grounded) {
        objective = 'Conecta la puesta a tierra (cable verde) a la toma del cuadro.';
      } else if (!electrical.state.on) {
        objective = 'Acciona el interruptor de corte del cuadro para poner el sistema en marcha.';
      } else {
        objective = 'Sistema en marcha. Pulsa CERTIFICAR en el cuadro de la instalación.';
      }
    }
    if (objective !== lastObjective) {
      lastObjective = objective;
      hud.setPhase(state.phase, phaseInfo[state.phase].name, objective);
    }
  }

  function refreshAll() {
    sync();
    advancePhase();
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

  for (const c of electrical.connectables) {
    interactions.registerGrab(c.item, {
      type: 'connector',
      maxDistance: 3.2,
      hoverScale: 1.06,
      enabled: () => !c.item.userData.connected,
      onGrab: (root, holder) => electrical.beginHold(root, holder),
      onRelease: (root) => electrical.release(root),
    });
  }

  const brush = world.brush;
  interactions.registerGrab(brush, {
    type: 'brush',
    maxDistance: 2.9,
    hoverScale: 1.08,
    onGrab: (root, holder) => {
      root.userData.state = 'held';
      root.userData.cleanT = 0;
      holder.attach(root);
      root.position.set(0, -0.05, -0.24);
      root.quaternion.identity();
      root.scale.setScalar(0.9);
      audio.pick();
      hud.toast('Cepillo en mano: frótalo sobre los paneles con polvo.', '');
      return true;
    },
    onRelease: (root) => {
      root.userData.state = 'free';
      scene.attach(root);
      root.position.copy(brush.userData.basePos);
      root.quaternion.copy(brush.userData.baseQuat);
      root.scale.setScalar(1);
    },
  });

  interactions.registerButton(
    world.accessPedestal,
    () => accessRoof(),
    { maxDistance: 4.2, hoverScale: 1 },
  );

  interactions.registerButton(
    world.descendPedestal,
    () => descend(),
    { maxDistance: 3.6, hoverScale: 1 },
  );

  interactions.registerButton(
    world.coffeeGroup,
    () => orderCoffee(),
    { maxDistance: 3.2, hoverScale: 1 },
  );

  world.coffeeGroup.updateWorldMatrix(true, true);
  const cupHome = world.coffeeGroup.localToWorld(new THREE.Vector3(-0.02, 0.95, 0.34));
  interactions.registerGrab(world.coffeeCup, {
    type: 'coffee',
    maxDistance: 2.9,
    hoverScale: 1.12,
    enabled: () => state.coffee.ordered && !state.coffee.done,
    onGrab: (root, holder) => {
      root.userData.state = 'held';
      holder.attach(root);
      root.position.set(0, -0.05, -0.18);
      root.quaternion.identity();
      root.scale.setScalar(1);
      audio.pick();
      hud.toast('Taza en mano: acércala a la boca para beber el café.', '');
      return true;
    },
    onRelease: (root) => {
      if (root.userData.drunk || state.coffee.done) return;
      root.getWorldPosition(_panelPos);
      player.camera.getWorldPosition(_brushPos);
      if (_panelPos.distanceTo(_brushPos) < 0.45) {
        drinkCoffee();
        return;
      }
      scene.attach(root);
      root.position.copy(cupHome);
      root.quaternion.identity();
      root.scale.setScalar(1);
      root.userData.state = 'dispensed';
      hud.toast('Acerca la taza a la boca para beber el café.', '');
    },
  });

  interactions.registerButton(
    world.finishConsole,
    () => finish(),
    { maxDistance: 4.0, hoverScale: 1 },
  );

  interactions.registerButton(electrical.switchButton, () => electrical.activateSwitch(), {
    maxDistance: 3.2,
    hoverScale: 1.04,
  });

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
    if (state.phase === 'coffee') {
      hud.toast('Estás de descanso: baja, pide el café y vuelve a ponerte el arnés.', 'err');
      audio.error();
      return;
    }
    if (!ppe.isComplete()) {
      hud.toast('Primero completa el EPI: casco, gafas, guantes y arnés.', 'err');
      audio.error();
      return;
    }
    if (state.phase === 'install' && player.onRoof()) {
      hud.toast('Ya estás en la cubierta.', '');
      return;
    }
    if (state.phase === 'epi') state.phase = 'install';
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
    const efficiency = placed ? solar.state.efficiency : 0;
    const ppeCount = ppe.count();

    const safety = ppeCount * 5 + (ppe.isComplete() ? 5 : 0); // 25
    const mounting = Math.min(placed / valid, 1) * 30;
    const performance = efficiency * 20;
    const electricalScore =
      (electrical.state.wired ? 6 : 0) +
      (electrical.state.grounded ? 4 : 0) +
      (electrical.state.on ? 5 : 0);
    const finishBonus = placed >= valid ? 10 : placed >= ENERGY.minPanels ? 5 : 0;
    const total = Math.round(safety + mounting + performance + electricalScore + finishBonus);
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
    if (solar.state.dusty > 0) {
      note = `Quedan ${solar.state.dusty} paneles con polvo: la suciedad reduce la producción.`;
    }
    if (placed < ENERGY.minPanels) {
      note = `Solo ${placed} paneles: la instalación no llega al mínimo de ${ENERGY.minPanels} para certificar.`;
    }
    if (!electrical.state.on && placed >= ENERGY.minPanels) {
      note = 'La instalación no se ha puesto en marcha: falta la conexión o el interruptor de corte.';
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
        { label: `Montaje (${placed}/${valid} paneles)`, value: `${Math.round(mounting)} / 30` },
        {
          label: `Rendimiento (${Math.round(efficiency * 100)} % de la irradiancia)`,
          value: `${Math.round(performance)} / 20`,
        },
        {
          label: `Conexión y puesta en marcha (${electrical.state.on ? 'en marcha' : 'parada'})`,
          value: `${electricalScore} / 15`,
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
    if (!electrical.state.on) {
      hud.toast('Antes de certificar, conecta el cable DC, la tierra y acciona el interruptor.', 'err');
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
    electrical.reset();
    state.coffee = { triggered: false, ordered: false, done: false };
    const cup = world.coffeeCup;
    cup.userData.drunk = false;
    cup.userData.state = 'dispensed';
    cup.visible = false;
    if (cup.parent !== world.coffeeGroup) world.coffeeGroup.attach(cup);
    cup.position.set(-0.02, 0.95, 0.34);
    cup.quaternion.identity();
    cup.scale.setScalar(1);
    brush.userData.state = 'free';
    scene.attach(brush);
    brush.position.copy(brush.userData.basePos);
    brush.quaternion.copy(brush.userData.baseQuat);
    brush.scale.setScalar(1);
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
    electrical,
    start,
    update: (dt) => {
      updateLifeline();
      updateCleaning(dt);
      const cup = world.coffeeCup;
      if (cup.userData.state === 'held' && !state.coffee.done) {
        cup.getWorldPosition(_panelPos);
        player.camera.getWorldPosition(_brushPos);
        if (_panelPos.distanceTo(_brushPos) < 0.36) drinkCoffee();
      }
    },
    accessRoof,
    onPanelPlaced,
    descend,
    orderCoffee,
    drinkCoffee,
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
    debugConnect() {
      electrical.debugConnect();
      refreshAll();
    },
    goTo(x, z, yaw = 0) {
      player.teleport(x, z, yaw);
      if (player.groundHeightAt(x, z) > 2) {
        if (state.phase === 'epi') state.phase = 'install';
        lastObjective = '';
      }
      refreshAll();
    },
  };

  return api;
}
