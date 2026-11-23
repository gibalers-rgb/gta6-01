// Screenshot staging: ?shot=chase|street|docks|sunset|title puts the game in
// a fixed, deterministic scene so a still frame shows the systems at work.
// This is the game's own code — the same code a player runs — with the
// camera and the situation chosen by a URL parameter.

import { makeCar, giveTrafficRoute } from './vehicles.js';
import { makePed } from './people.js';
import { addHeat, spawnCopCar, spawnFootCop } from './police.js';
import { startMission } from './missions.js';
import { nearestRoadPoint } from './city.js';

function placePlayerInCar(G, x, y, angle, type) {
  const car = makeCar(G.city, G.rng, {
    kind: 'player', type, x, y, angle,
    color: type === 'taxi' ? '#e8c33a' : '#c93a6a',
  });
  car.speed = 260;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
}

function addTrafficAround(G, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const p = nearestRoadPoint(cx + G.rng.range(-420, 420), cy + G.rng.range(-320, 320));
    const car = makeCar(G.city, G.rng, { kind: 'traffic', x: p.x, y: p.y });
    giveTrafficRoute(car, G.rng);
    car.speed = car.ai.cruise;
    G.cars.push(car);
  }
}

function addPedsAround(G, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const p = nearestRoadPoint(cx + G.rng.range(-380, 380), cy + G.rng.range(-280, 280));
    const ped = makePed(G.city, G.rng, p.x + G.rng.range(-30, 30), p.y + G.rng.range(-30, 30));
    G.peds.push(ped);
  }
}

export function applyShot(G, name) {
  G.shotMode = name;
  G.state = 'playing';
  G.player.cash = 1840;
  G.player.hp = 86;
  G.player.armor = 40;
  G.player.weapon = 'pistol';
  G.player.ammoInMag = 9;
  G.player.ammoReserve = 48;

  if (name === 'chase') {
    // A three-star pursuit downtown, mission 3 live.
    G.clockHour = 15.2;
    G.autoDrive = true;
    placePlayerInCar(G, 1560, 1000, 0, 'sport');
    addTrafficAround(G, 1300, 1000, 4);
    addTrafficAround(G, 1560, 1400, 3);
    addPedsAround(G, 1560, 1000, 8);
    startMission(G, 2);
    G.dialogue = [];
    spawnCopCar(G); spawnCopCar(G);
    const c1 = G.cars[G.cars.length - 1];
    c1.x = 1330; c1.y = 1000; c1.angle = 0; c1.speed = 380;
    const c2 = G.cars[G.cars.length - 2];
    c2.x = 1790; c2.y = 1120; c2.angle = Math.PI; c2.speed = 360;
    G.cam.x = 1560; G.cam.y = 1000;
    G.feed('Police pursuit — 3 stars', '#ff8a7a');
  } else if (name === 'street') {
    // On foot in Old Town, first job offered, traffic and crowds.
    G.clockHour = 10.4;
    G.player.x = 760; G.player.y = 640;
    G.player.angle = Math.PI / 2;
    addTrafficAround(G, 760, 640, 8);
    addPedsAround(G, 760, 640, 14);
    G.progress.missionIndex = 0;
    G.feed('Mira is calling — press ENTER to take the job', '#ffd23a');
    G.cam.x = 760; G.cam.y = 640;
  } else if (name === 'docks') {
    // The Pier 9 crate job, guards posted, golden hour.
    G.clockHour = 17.4;
    G.player.x = 2700; G.player.y = 1560;
    G.player.angle = 0;
    G.player.weapon = 'smg';
    G.player.ammoInMag = 30;
    startMission(G, 3);
    G.dialogue = [];
    spawnFootCop(G, 2760, 1500);
    spawnFootCop(G, 2760, 1900);
    addTrafficAround(G, 2900, 1500, 2);
    G.cam.x = 2700; G.cam.y = 1560;
  } else if (name === 'sunset') {
    // A taxi fare along the beachfront at sunset, one star on the tail.
    G.clockHour = 18.6;
    G.autoDrive = true;
    placePlayerInCar(G, 1200, 2100, 0, 'taxi');
    G.player.car.speed = 300;
    addTrafficAround(G, 1000, 2100, 3);
    addTrafficAround(G, 1200, 1800, 2);
    addPedsAround(G, 1200, 2100, 6);
    G.fare = { dest: { x: 420, y: 1980, name: 'Beachfront' }, timer: 62, pay: 45 };
    addHeat(G, 12, '');
    spawnCopCar(G);
    const c = G.cars[G.cars.length - 1];
    c.x = 950; c.y = 2100; c.angle = 0; c.speed = 330;
    G.cam.x = 1200; G.cam.y = 2100;
  }
  // Settle the world a couple of seconds so traffic spreads out naturally.
  for (let i = 0; i < 120; i++) G.stepWorld(1 / 60);
  G.banner = null;
  G.feedItems = [];
  if (name === 'chase') G.feed('WANTED ★★★ — lose the cops!', '#ff8a7a');
  if (name === 'docks') G.feed('Pier 9 — collect the crates', '#ffd23a');
  if (name === 'sunset') G.feed('Fare to Beachfront — 62s', '#37d67a');
}
