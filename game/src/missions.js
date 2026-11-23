// Missions and side work: a five-job story for Leo Vane, plus taxi fares
// for honest money between jobs. Each mission is a small step machine:
// go somewhere, take something, lose the cops, bring it home.

import { dist } from './rng.js';
import { addHeat, spawnFootCop } from './police.js';
import { addFloatText, spawnBurst } from './fx.js';
import { makePed } from './people.js';

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Borrowed Wheels',
    reward: 300,
    intro: [
      'MIRA: Leo. You owe Kane two grand and he collects tonight.',
      'MIRA: First, wheels. Any car on the street. Take it, then bring it to Rico\'s paint shop so it stops looking stolen.',
    ],
    steps: [
      { kind: 'steal', label: 'Steal any car (walk up and press E)' },
      { kind: 'goto', x: 760, y: 1530, r: 70, label: 'Drive to Rico\'s Paint & Body', needCar: true },
    ],
  },
  {
    id: 'courier',
    title: 'Three Drops',
    reward: 500,
    intro: [
      'MIRA: Kane\'s couriers are all in holding cells. You are the courier now.',
      'MIRA: Three drops, two and a half minutes. Do not get cute with the cops.',
    ],
    timer: 150,
    steps: [
      { kind: 'goto', x: 1120, y: 320, r: 60, label: 'Drop 1 — Old Town apartments' },
      { kind: 'goto', x: 2280, y: 1080, r: 60, label: 'Drop 2 — Midtown offices' },
      { kind: 'goto', x: 640, y: 1960, r: 60, label: 'Drop 3 — Marina lockers' },
    ],
  },
  {
    id: 'heatrun',
    title: 'Lose the Heat',
    reward: 800,
    intro: [
      'MIRA: Kane wants to know if you can drive. The PD is about to find out too.',
      'MIRA: I tipped them off myself. Three stars. Lose them and you are in.',
    ],
    steps: [
      { kind: 'escape', label: 'Lose the 3-star wanted level — stay out of sight' },
    ],
  },
  {
    id: 'docks',
    title: 'Dockside Grab',
    reward: 1200,
    intro: [
      'MIRA: Four crates on Pier 9 belong to Kane. Kane\'s men are watching the pier.',
      'MIRA: Grab the crates. The guards shoot first. So do you.',
    ],
    steps: [
      {
        kind: 'collect',
        label: 'Collect the 4 crates on Pier 9',
        items: [
          { x: 2700, y: 1320, taken: false },
          { x: 2700, y: 1620, taken: false },
          { x: 2700, y: 1920, taken: false },
          { x: 2720, y: 2050, taken: false },
        ],
      },
    ],
  },
  {
    id: 'score',
    title: 'The Solara Score',
    reward: 2500,
    intro: [
      'MIRA: The bank on Bay Avenue. Kane\'s crew opens the vault, you drive.',
      'MIRA: Grab the cash, outrun the whole department, and get home. Then we are even.',
    ],
    steps: [
      { kind: 'goto', x: 1570, y: 1140, r: 60, label: 'Get to Bay Federal Bank' },
      { kind: 'grab', x: 1570, y: 1140, r: 55, hold: 3, label: 'Hold still — empty the vault' },
      { kind: 'escape', label: 'Escape the 4-star wanted level and reach the safehouse', needHeat: 4 },
      { kind: 'goto', x: 525, y: 375, r: 70, label: 'Get home to the safehouse', needCalm: true },
    ],
  },
];

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return;
  G.mission = {
    def,
    index,
    step: 0,
    timer: def.timer || 0,
    elapsed: 0,
    grabProgress: 0,
    cratesSpawned: false,
  };
  G.dialogue = [...def.intro];
  G.dialogueTimer = 0;
  G.feed(`New mission: ${def.title}`, '#ffd23a');
  if (def.id === 'heatrun') addHeat(G, 60, 'Mira tipped off the PD');
  if (def.id === 'score') G.audio.jingle();
}

export function missionTarget(G) {
  const m = G.mission;
  if (!m) return null;
  const step = m.def.steps[m.step];
  if (!step) return null;
  if (step.kind === 'goto' || step.kind === 'grab') return { x: step.x, y: step.y, label: step.label };
  if (step.kind === 'collect') {
    const next = step.items.find((it) => !it.taken);
    if (next) return { x: next.x, y: next.y, label: step.label };
    return null;
  }
  if (step.kind === 'escape') return { x: G.player.x, y: G.player.y, label: step.label };
  if (step.kind === 'steal') return { x: G.player.x, y: G.player.y, label: step.label };
  return null;
}

function advanceStep(G) {
  const m = G.mission;
  m.step += 1;
  m.grabProgress = 0;
  if (m.step >= m.def.steps.length) {
    completeMission(G);
  } else {
    const step = m.def.steps[m.step];
    if (step.kind === 'escape' && step.needHeat) addHeat(G, 70, 'The vault alarm is screaming');
    if (step.kind === 'goto' && step.needCalm && G.wanted > 0) {
      // Player must be calm before the final leg counts.
    }
    G.feed(step.label, '#ffd23a');
  }
}

function completeMission(G) {
  const m = G.mission;
  const bonus = m.def.timer ? Math.floor(m.timer) * 2 : 0;
  const total = m.def.reward + bonus;
  G.player.cash += total;
  G.stats.missions += 1;
  G.progress.missionIndex = Math.max(G.progress.missionIndex, m.index + 1);
  G.banner = { title: 'MISSION PASSED', sub: `${m.def.title}  +$${total}`, timer: 3.2, color: '#37d67a' };
  G.audio.jingle();
  G.mission = null;
  G.save();
  if (m.index === MISSIONS.length - 1) {
    G.storyDone = true;
    G.banner = { title: 'KING OF SOLARA BAY', sub: 'The whole story is yours. Free roam — the city is open.', timer: 5, color: '#ffd23a' };
  }
}

function failMission(G, reason) {
  G.banner = { title: 'MISSION FAILED', sub: reason, timer: 3, color: '#ff5a5a' };
  G.audio.fail();
  G.mission = null;
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  m.elapsed += dt;
  if (m.def.timer) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(G, 'Out of time — Mira is not impressed.');
      return;
    }
  }
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = G.player;

  if (step.kind === 'steal') {
    if (p.car) advanceStep(G);
  } else if (step.kind === 'goto') {
    if (step.needCalm && G.wanted > 0) {
      // Wait until the heat is off before the marker counts.
    } else if (dist(p.x, p.y, step.x, step.y) < step.r) {
      advanceStep(G);
    }
  } else if (step.kind === 'grab') {
    if (dist(p.x, p.y, step.x, step.y) < step.r) {
      m.grabProgress += dt;
      if (Math.floor(m.grabProgress * 4) !== Math.floor((m.grabProgress - dt) * 4)) {
        G.audio.blip(660, 0.05, 'square', 0.08);
      }
      if (m.grabProgress >= step.hold) {
        p.cash += 0; // the reward lands at mission completion
        addFloatText(G, p.x, p.y - 30, 'Vault emptied!', '#ffd23a');
        advanceStep(G);
      }
    } else {
      m.grabProgress = Math.max(0, m.grabProgress - dt * 2);
    }
  } else if (step.kind === 'collect') {
    if (!m.cratesSpawned) {
      m.cratesSpawned = true;
      for (const pos of [{ x: 2760, y: 1450 }, { x: 2760, y: 1780 }, { x: 2760, y: 2050 }]) {
        spawnFootCop(G, pos.x, pos.y);
      }
      G.feed('Pier guards are armed. Watch yourself.', '#ff8a7a');
    }
    let remaining = 0;
    for (const item of step.items) {
      if (!item.taken) {
        remaining += 1;
        if (dist(p.x, p.y, item.x, item.y) < 44) {
          item.taken = true;
          G.audio.pickup();
          addFloatText(G, item.x, item.y - 20, 'Crate secured', '#ffd23a');
        }
      }
    }
    if (remaining === 0) advanceStep(G);
  } else if (step.kind === 'escape') {
    if (step.needHeat && G.wanted < 4 && m.elapsed < 2) {
      // The heat is still building; give it a moment.
    } else if (G.wanted === 0) {
      advanceStep(G);
    }
  }
}

// Taxi fares: a waiting pedestrian with a $ marker. Stop beside them in a car.
export function updateFares(G, dt) {
  G.fareCooldown -= dt;
  if (!G.fare) {
    if (G.fareCooldown <= 0 && G.player.car) {
      const near = G.peds.find((ped) => !ped.fare && dist(ped.x, ped.y, G.player.x, G.player.y) < 500);
      if (near && G.rng.chance(0.02)) {
        near.fare = true;
        G.fareWaiting = near;
        G.feed('A pedestrian is hailing a ride — stop beside them.', '#37d67a');
        G.fareCooldown = 25;
      }
    }
    return;
  }
  const fare = G.fare;
  fare.timer -= dt;
  if (fare.timer <= 0) {
    G.feed('The passenger gave up and left.', '#ff8a7a');
    G.fare = null;
    return;
  }
  if (dist(G.player.x, G.player.y, fare.dest.x, fare.dest.y) < 55) {
    const tip = Math.max(0, Math.floor(fare.timer));
    const pay = fare.pay + tip;
    G.player.cash += pay;
    G.stats.fares += 1;
    addFloatText(G, G.player.x, G.player.y - 30, `Fare +$${pay}`, '#37d67a');
    G.audio.pickup();
    G.fare = null;
    G.fareCooldown = 18;
  }
}

export function tryPickupFare(G) {
  if (G.fare || !G.fareWaiting || !G.player.car) return;
  const ped = G.fareWaiting;
  if (dist(ped.x, ped.y, G.player.x, G.player.y) < 60 && Math.abs(G.player.car.speed) < 40) {
    const dests = [
      { x: 1540, y: 320, name: 'Downtown hotel' },
      { x: 420, y: 1980, name: 'Beachfront' },
      { x: 2360, y: 620, name: 'The Hills' },
      { x: 1180, y: 1680, name: 'Midtown plaza' },
      { x: 2720, y: 1980, name: 'Pier 9' },
    ];
    const dest = G.rng.pick(dests);
    G.peds.splice(G.peds.indexOf(ped), 1);
    G.fare = { dest, timer: 75, pay: 45 };
    G.fareWaiting = null;
    G.feed(`Passenger aboard — take them to ${dest.name}.`, '#37d67a');
  }
}

export function drawMissionMarkers(ctx, G, time) {
  const target = missionTarget(G);
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  if (target && target.label !== 'Steal any car (walk up and press E)' && target.label !== 'Lose the 3-star wanted level — stay out of sight' && target.label !== 'Escape the 4-star wanted level and reach the safehouse') {
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.moveTo(0, -52 * pulse);
    ctx.lineTo(12, -30);
    ctx.lineTo(-12, -30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const m = G.mission;
  if (m) {
    const step = m.def.steps[m.step];
    if (step && step.kind === 'collect') {
      for (const item of step.items) {
        if (item.taken) continue;
        ctx.fillStyle = '#c9863a';
        ctx.fillRect(item.x - 16, item.y - 12, 32, 24);
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x - 16, item.y - 12, 32, 24);
        ctx.strokeStyle = '#ffd23a';
        ctx.strokeRect(item.x - 10, item.y - 6, 20, 12);
      }
    }
    if (step && step.kind === 'grab' && m.grabProgress > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(G.player.x - 50, G.player.y - 52, 100, 10);
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(G.player.x - 50, G.player.y - 52, 100 * (m.grabProgress / step.hold), 10);
    }
  }
  if (G.fare) {
    ctx.save();
    ctx.translate(G.fare.dest.x, G.fare.dest.y);
    ctx.strokeStyle = '#37d67a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 20px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 7);
    ctx.restore();
  }
}
