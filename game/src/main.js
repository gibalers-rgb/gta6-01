// Solara Heat — bootstrap, game loop, input, save/load and the render pass.
// The world systems live in their own modules; this file wires them together.

import { buildCity, drawCity, collideWorld, districtAt, ROADS_X, ROADS_Y } from './city.js';
import { makeRng, clamp, dist, angleTo, angleDiff } from './rng.js';
import { createAudio } from './audio.js';
import { makeCar, giveTrafficRoute, spawnTraffic, updateTraffic, updatePlayerCar, resolveCarBumps, drawCar } from './vehicles.js';
import { spawnPeds, updatePeds, drawPed } from './people.js';
import { updatePolice, addHeat, wastePlayer } from './police.js';
import { fireWeapon, reloadWeapon, updateBullets, updatePickups, spawnPickups, drawPickups, drawBullets, WEAPONS } from './combat.js';
import { startMission, updateMission, updateFares, tryPickupFare, drawMissionMarkers, MISSIONS } from './missions.js';
import { drawHUD, drawTitle, drawPause, drawEndCard } from './hud.js';
import { updateFx, drawFx, spawnBurst } from './fx.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'solara-heat-v1';
const RADIO = ['SOLARA FM 88.2', 'BAY BEATS 101.1', 'PIER 9 ROCK 96.4'];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const selfTest = params.get('selftest') === '1';

window.addEventListener('error', (e) => {
  if (selfTest) document.title = `SELFTEST FAIL: ${e.message}`;
});

function createGame() {
  const rng = makeRng(20261124);
  const city = buildCity(20261124);
  const G = {
    rng,
    city,
    viewW: 1280,
    viewH: 720,
    time: 0,
    clockHour: 9.0,
    cam: { x: 700, y: 600, zoom: 1 },
    shake: 0,
    state: 'title',
    stateTimer: 0,
    hasSave: false,
    storyDone: false,
    input: { up: false, down: false, left: false, right: false, handbrake: false, sprint: false, mouseDown: false, mouseEdge: false, mx: 640, my: 360 },
    mouse: { x: 640, y: 360 },
    player: null,
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    floatTexts: [],
    pickups: [],
    heat: 0,
    wanted: 0,
    crimeTimer: 0,
    lastCrimeAt: -100,
    spawnTimer: 0,
    gunfireTimer: 0,
    muzzle: 0,
    hurtFlash: 0,
    godTimer: 0,
    mission: null,
    progress: { missionIndex: 0 },
    stats: { missions: 0, fares: 0, stashes: 0, kills: 0 },
    fare: null,
    fareWaiting: null,
    fareCooldown: 12,
    dialogue: [],
    dialogueTimer: 0,
    banner: null,
    feedItems: [],
    radioIndex: 0,
    autosaveTimer: 0,
    shotMode: null,
    autoDrive: false,
    audio: createAudio(),
  };

  G.feed = function feed(text, color = '#ffffff') {
    G.feedItems.push({ text, color, life: 6 });
    if (G.feedItems.length > 5) G.feedItems.shift();
  };

  G.save = function save() {
    try {
      const data = {
        cash: G.player.cash,
        missionIndex: G.progress.missionIndex,
        stats: G.stats,
        x: G.player.x,
        y: G.player.y,
        clockHour: G.clockHour,
        storyDone: G.storyDone,
        taken: G.pickups.map((p) => (p.taken ? 1 : 0)),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) { /* storage unavailable — the game still plays */ }
  };

  G.load = function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      G.player.cash = data.cash ?? 250;
      G.progress.missionIndex = data.missionIndex ?? 0;
      G.stats = data.stats ?? G.stats;
      G.player.x = data.x ?? 700;
      G.player.y = data.y ?? 600;
      G.clockHour = data.clockHour ?? 9;
      G.storyDone = !!data.storyDone;
      if (Array.isArray(data.taken)) {
        data.taken.forEach((t, i) => { if (t && G.pickups[i]) G.pickups[i].taken = true; });
      }
      return true;
    } catch (err) {
      return false;
    }
  };

  G.player = {
    x: 700, y: 600,
    angle: 0,
    aimAngle: 0,
    hp: 100,
    armor: 0,
    cash: 250,
    car: null,
    weapon: 'pistol',
    weapons: { fists: true, pistol: true, smg: false },
    ammoInMag: 12,
    ammoReserve: 48,
    attackCooldown: 0,
    moveX: 0,
    moveY: 0,
  };

  return G;
}

const G = createGame();
window.__game = G;

function resetWorld() {
  G.cars = spawnTraffic(G.city, G.rng, G.player, 14);
  G.peds = spawnPeds(G.city, G.rng, G.player, 26);
  G.cops = [];
  G.bullets = [];
  G.particles = [];
  G.floatTexts = [];
  G.pickups = [];
  spawnPickups(G);
  G.mission = null;
  G.fare = null;
  G.fareWaiting = null;
  G.heat = 0;
  G.wanted = 0;
  G.banner = null;
  G.dialogue = [];
  G.feedItems = [];
  G.time = 0;
}

function startNewGame() {
  G.player.hp = 100;
  G.player.armor = 0;
  G.player.cash = 250;
  G.player.car = null;
  G.player.weapon = 'pistol';
  G.player.weapons = { fists: true, pistol: true, smg: false };
  G.player.ammoInMag = 12;
  G.player.ammoReserve = 48;
  G.player.x = 700;
  G.player.y = 600;
  G.progress.missionIndex = 0;
  G.stats = { missions: 0, fares: 0, stashes: 0, kills: 0 };
  G.storyDone = false;
  G.clockHour = 9;
  resetWorld();
  G.state = 'playing';
  G.audio.ensure();
  G.feed('Welcome to Solara Bay. Mira is calling — press ENTER.', '#ffd23a');
}

function continueGame() {
  resetWorld();
  G.load();
  G.state = 'playing';
  G.audio.ensure();
  G.feed('Welcome back to Solara Bay.', '#ffd23a');
}

// --- Input ---------------------------------------------------------------

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'handbrake',
};

window.addEventListener('keydown', (e) => {
  G.audio.ensure();
  if (KEYMAP[e.code] !== undefined) {
    G.input[KEYMAP[e.code]] = true;
    if (e.code === 'Space') e.preventDefault();
  }
  if (e.repeat) return;
  if (e.code === 'Enter') onEnter();
  if (e.code === 'Escape') onEscape();
  if (e.code === 'KeyE') onInteract();
  if (e.code === 'KeyR') reloadWeapon(G);
  if (e.code === 'KeyM') {
    G.audio.musicOn = !G.audio.musicOn;
    G.feed(`Music ${G.audio.musicOn ? 'on' : 'off'} — ${RADIO[G.radioIndex]}`, '#cfd8e3');
  }
  if (e.code === 'KeyF' && G.player.car) {
    G.radioIndex = (G.radioIndex + 1) % RADIO.length;
    G.feed(`Radio: ${RADIO[G.radioIndex]}`, '#cfd8e3');
  }
  if (e.code === 'Digit1') switchWeapon('fists');
  if (e.code === 'Digit2') switchWeapon('pistol');
  if (e.code === 'Digit3' && G.player.weapons.smg) switchWeapon('smg');
  if (e.code === 'KeyS' && G.state === 'paused') { G.save(); G.feed('Game saved.', '#37d67a'); }
  if (e.code === 'KeyQ' && G.state === 'paused') { G.state = 'title'; G.stateTimer = 0; }
});

window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) G.input[KEYMAP[e.code]] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  G.mouse.x = ((e.clientX - rect.left) / rect.width) * G.viewW;
  G.mouse.y = ((e.clientY - rect.top) / rect.height) * G.viewH;
});

canvas.addEventListener('mousedown', (e) => {
  G.audio.ensure();
  G.input.mouseDown = true;
  G.input.mouseEdge = true;
  const rect = canvas.getBoundingClientRect();
  G.mouse.x = ((e.clientX - rect.left) / rect.width) * G.viewW;
  G.mouse.y = ((e.clientY - rect.top) / rect.height) * G.viewH;
  if (G.dialogue.length) advanceDialogue();
});

window.addEventListener('mouseup', () => {
  G.input.mouseDown = false;
});

function switchWeapon(name) {
  if (!G.player.weapons[name]) return;
  G.player.weapon = name;
  G.audio.blip(440, 0.05);
}

function advanceDialogue() {
  if (!G.dialogue.length) return;
  G.dialogue.shift();
  G.dialogueTimer = 0;
  G.audio.blip(700, 0.05);
}

function onEnter() {
  if (G.state === 'title') {
    if (G.hasSave) continueGame();
    else startNewGame();
    return;
  }
  if (G.state === 'busted' || G.state === 'wasted') {
    G.state = 'playing';
    G.godTimer = 2;
    return;
  }
  if (G.state !== 'playing') return;
  if (G.dialogue.length) {
    advanceDialogue();
    return;
  }
  if (!G.mission && G.progress.missionIndex < MISSIONS.length) {
    startMission(G, G.progress.missionIndex);
  }
}

function onEscape() {
  if (G.state === 'playing') G.state = 'paused';
  else if (G.state === 'paused') G.state = 'playing';
}

function onInteract() {
  if (G.state !== 'playing' || G.dialogue.length) return;
  const p = G.player;
  if (p.car) {
    // Step out and leave the car parked where it is.
    const car = p.car;
    car.speed = 0;
    p.x = car.x - Math.cos(car.angle) * 40;
    p.y = car.y - Math.sin(car.angle) * 40;
    const fixed = collideWorld(G.city, p.x, p.y, 14);
    p.x = fixed.x; p.y = fixed.y;
    p.car = null;
    G.audio.door();
    return;
  }
  // Find the nearest car to steal.
  let best = null;
  let bestD = 78;
  for (const car of G.cars) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  const wasOwn = best.kind === 'player';
  const wasCop = best.kind === 'cop';
  best.kind = 'player';
  best.ai = null;
  best.speed = 0;
  p.car = best;
  p.x = best.x;
  p.y = best.y;
  G.audio.door();
  if (!wasOwn) {
    G.stats.carsStolen = (G.stats.carsStolen || 0) + 1;
    addHeat(G, wasCop ? 20 : 12, wasCop ? 'You stole a police cruiser!' : 'Car stolen');
  }
}

// --- World update ----------------------------------------------------------

G.stepWorld = function stepWorld(dt) {
  G.time += dt;
  G.clockHour = (G.clockHour + dt / 90) % 24;
  const p = G.player;
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  G.muzzle = Math.max(0, G.muzzle - dt);
  G.gunfireTimer = Math.max(0, G.gunfireTimer - dt);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt);
  G.godTimer = Math.max(0, G.godTimer - dt);
  if (G.banner) {
    G.banner.timer -= dt;
    if (G.banner.timer <= 0) G.banner = null;
  }
  for (let i = G.feedItems.length - 1; i >= 0; i--) {
    G.feedItems[i].life -= dt;
    if (G.feedItems[i].life <= 0) G.feedItems.splice(i, 1);
  }
  if (G.dialogue.length) {
    G.dialogueTimer += dt;
    if (G.dialogueTimer > 7) advanceDialogue();
  }

  // Aim: the mouse points in world space.
  const wx = G.cam.x + (G.mouse.x - G.viewW / 2) / G.cam.zoom;
  const wy = G.cam.y + (G.mouse.y - G.viewH / 2) / G.cam.zoom;
  p.aimAngle = angleTo(p.x, p.y, wx, wy);

  // Screenshot staging only: keep the car rolling down its avenue so a
  // still frame catches the chase in motion, not parked in traffic.
  if (G.autoDrive && p.car) {
    G.input.up = true;
    G.input.down = false;
    const rx = ROADS_X.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
    const ry = ROADS_Y.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
    let desired;
    if (Math.abs(p.x - rx) < Math.abs(p.y - ry)) {
      desired = Math.sin(p.car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      desired = Math.cos(p.car.angle) >= 0 ? 0 : Math.PI;
    }
    const diff = angleDiff(p.car.angle, desired);
    G.input.left = diff < -0.06;
    G.input.right = diff > 0.06;
  }

  if (p.car) {
    const destroyed = updatePlayerCar(G, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    if (destroyed) {
      G.cars.splice(G.cars.indexOf(p.car), 1);
      p.car = null;
      damagePlayer(G, 25, 'crash');
    }
    resolveCarBumps(G);
    tryPickupFare(G);
  } else {
    // On foot.
    const ix = (G.input.right ? 1 : 0) - (G.input.left ? 1 : 0);
    const iy = (G.input.down ? 1 : 0) - (G.input.up ? 1 : 0);
    const moving = ix !== 0 || iy !== 0;
    const speed = G.input.sprint ? 340 : 225;
    if (moving) {
      const len = Math.hypot(ix, iy);
      const nx = p.x + (ix / len) * speed * dt;
      const ny = p.y + (iy / len) * speed * dt;
      const fixed = collideWorld(G.city, nx, ny, 14);
      p.x = fixed.x;
      p.y = fixed.y;
      p.angle = Math.atan2(iy, ix);
    }
    // Traffic can run the player over.
    for (const car of G.cars) {
      if (car.kind === 'traffic' && Math.abs(car.speed) > 120 && dist(p.x, p.y, car.x, car.y) < 30) {
        damagePlayer(G, 18, 'traffic');
        p.x += (p.x - car.x) * 0.4;
        p.y += (p.y - car.y) * 0.4;
        car.speed *= 0.4;
      }
    }
    // Fire.
    const w = WEAPONS[p.weapon];
    if (G.input.mouseDown && (w.auto || G.input.mouseEdge)) {
      fireWeapon(G);
    }
  }
  G.input.mouseEdge = false;

  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateMission(G, dt);
  updateFares(G, dt);
  updateFx(G, dt);

  // Camera: follow the player, pull out a little at speed.
  const wantZoom = p.car ? 0.88 : 1.0;
  G.cam.zoom += (wantZoom - G.cam.zoom) * Math.min(1, 2 * dt);
  G.cam.x += (p.x - G.cam.x) * Math.min(1, 6 * dt);
  G.cam.y += (p.y - G.cam.y) * Math.min(1, 6 * dt);

  // Engine and music.
  const speedRatio = p.car ? Math.abs(p.car.speed) / 520 : 0;
  G.audio.update(dt, speedRatio, G.wanted);

  // Autosave every 45 seconds of play.
  G.autosaveTimer += dt;
  if (G.autosaveTimer > 45) {
    G.autosaveTimer = 0;
    G.save();
  }
};

function damagePlayer(G, amount, source) {
  const p = G.player;
  if (G.state !== 'playing' || G.godTimer > 0) return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  G.hurtFlash = 0.5;
  if (p.hp <= 0) {
    p.hp = 0;
    wastePlayer(G);
  }
}

// --- Render ----------------------------------------------------------------

function drawPlayer(ctx, G, time) {
  const p = G.player;
  if (p.car) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 7, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.aimAngle);
  // Gun.
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -2, 16, 4);
    if (G.muzzle > 0) {
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(26, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Body: teal jacket, dark jeans — Leo Vane.
  ctx.fillStyle = '#2c4a4a';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f8a70';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(5, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath(); ctx.arc(6, -2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Name tag while standing still on the title backdrop.
  if (G.state === 'title') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('LEO VANE', p.x, p.y - 22);
  }
}

function render(G) {
  const W = G.viewW;
  const H = G.viewH;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, W, H);

  const shX = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;
  const shY = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(W / 2 + shX, H / 2 + shY);
  ctx.scale(G.cam.zoom, G.cam.zoom);
  ctx.translate(-G.cam.x, -G.cam.y);

  drawCity(ctx, G.city, G.cam, G.clockHour);
  drawMissionMarkers(ctx, G, G.time);
  drawPickups(ctx, G, G.time);
  for (const car of G.cars) drawCar(ctx, car, G.time);
  for (const ped of G.peds) drawPed(ctx, ped, G.time);
  for (const cop of G.cops) drawPed(ctx, { ...cop, walkPhase: G.time * 10 }, G.time);
  drawPlayer(ctx, G, G.time);
  drawBullets(ctx, G);
  drawFx(ctx, G);
  ctx.restore();

  if (G.state === 'title') {
    drawTitle(ctx, G);
  } else if (G.state === 'playing') {
    drawHUD(ctx, G);
  } else if (G.state === 'paused') {
    drawHUD(ctx, G);
    drawPause(ctx, G);
  } else if (G.state === 'busted') {
    drawEndCard(ctx, G, 'BUSTED', 'The Solara PD took their cut. You walk out owing a little less pride.', '#5aa8e0');
  } else if (G.state === 'wasted') {
    drawEndCard(ctx, G, 'WASTED', 'St. Marisol patched you up — and sent the bill to your tab.', '#ff5a5a');
  }
}

// --- Boot ------------------------------------------------------------------

G.hasSave = (() => {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (err) { return false; }
})();

// A quiet world behind the title screen.
resetWorld();
G.cam.x = 1600;
G.cam.y = 1200;

if (shotName && shotName !== 'title') {
  resetWorld();
  applyShot(G, shotName);
} else if (shotName === 'title') {
  G.shotMode = 'title';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'playing') {
    G.stepWorld(dt);
  } else if (G.state === 'title') {
    G.time += dt;
    G.cam.x += 12 * dt;
    if (G.cam.x > 2400) G.cam.x = 800;
    G.clockHour = (G.clockHour + dt / 240) % 24;
    updateFx(G, dt);
  } else if (G.state === 'busted' || G.state === 'wasted') {
    G.stateTimer += dt;
    updateFx(G, dt);
  }
  render(G);
  requestAnimationFrame(frame);
}

if (selfTest) {
  // Headless verification: run the simulation, then report in the title.
  try {
    resetWorld();
    G.state = 'playing';
    for (let i = 0; i < 240; i++) G.stepWorld(1 / 60);
    startMission(G, 0);
    for (let i = 0; i < 120; i++) G.stepWorld(1 / 60);
    render(G);
    const checks = [
      G.cars.length >= 10,
      G.peds.length >= 10,
      G.pickups.length === 20,
      MISSIONS.length === 5,
      !!G.mission,
    ];
    const ok = checks.every(Boolean);
    document.title = ok
      ? `SELFTEST PASS cars=${G.cars.length} peds=${G.peds.length} pickups=${G.pickups.length} mission=${G.mission.def.id} cash=${G.player.cash}`
      : `SELFTEST FAIL checks=${checks.map((c) => (c ? 1 : 0)).join('')}`;
  } catch (err) {
    document.title = `SELFTEST FAIL: ${err.message}`;
  }
} else {
  requestAnimationFrame(frame);
}
