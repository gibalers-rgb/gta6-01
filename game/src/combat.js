// Combat: fists, pistol and SMG, bullets, and the pickups scattered around
// the city (cash stashes, health, armor, ammo).

import { pointInBuilding } from './city.js';
import { dist, clamp } from './rng.js';
import { spawnBurst, addFloatText, shake } from './fx.js';
import { addHeat, wastePlayer } from './police.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 18, rate: 0.38, range: 46, auto: false },
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, range: 520, auto: false, mag: 12 },
  smg: { name: 'SMG', damage: 16, rate: 0.09, range: 460, auto: true, mag: 30 },
};

export function fireWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (p.attackCooldown > 0) return;
  if (p.weapon === 'fists') {
    p.attackCooldown = w.rate;
    G.audio.punch();
    const reach = w.range;
    const ax = p.x + Math.cos(p.aimAngle) * reach;
    const ay = p.y + Math.sin(p.aimAngle) * reach;
    let hit = false;
    for (const ped of G.peds) {
      if (dist(ax, ay, ped.x, ped.y) < 30) {
        damagePed(G, ped, w.damage);
        hit = true;
      }
    }
    for (const cop of G.cops) {
      if (dist(ax, ay, cop.x, cop.y) < 30) {
        cop.hp -= w.damage;
        spawnBurst(G, cop.x, cop.y, '#ff5a5a', 8, 200, 0.4);
        hit = true;
      }
    }
    if (hit) shake(G, 2);
    return;
  }
  if (p.ammoInMag <= 0) {
    G.audio.blip(140, 0.08);
    if (p.ammoReserve > 0) reloadWeapon(G);
    return;
  }
  p.attackCooldown = w.rate;
  p.ammoInMag -= 1;
  G.gunfireTimer = 1.2;
  const spread = p.weapon === 'smg' ? 0.09 : 0.03;
  const a = p.aimAngle + G.rng.range(-spread, spread);
  G.bullets.push({
    x: p.x + Math.cos(a) * 20,
    y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 950,
    vy: Math.sin(a) * 950,
    life: 0.8,
    damage: w.damage,
    from: 'player',
  });
  G.audio.shot();
  addHeat(G, 3, '');
  G.muzzle = 0.06;
}

export function reloadWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (!w.mag || p.ammoReserve <= 0 || p.ammoInMag >= w.mag) return;
  const need = w.mag - p.ammoInMag;
  const take = Math.min(need, p.ammoReserve);
  p.ammoInMag += take;
  p.ammoReserve -= take;
  p.attackCooldown = Math.max(p.attackCooldown, 0.7);
  G.audio.blip(520, 0.07);
}

export function damagePed(G, ped, damage) {
  ped.hp -= damage;
  spawnBurst(G, ped.x, ped.y, '#ff5a5a', 8, 200, 0.4);
  if (ped.hp <= 0) {
    const idx = G.peds.indexOf(ped);
    if (idx >= 0) G.peds.splice(idx, 1);
    spawnBurst(G, ped.x, ped.y, '#ff5a5a', 18, 260, 0.7);
    G.stats.kills += 1;
    addHeat(G, 10, 'A pedestrian was killed');
  } else {
    ped.fleeing = true;
    ped.fleeTimer = 3;
  }
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && pointInBuilding(G.city, b.x, b.y)) {
      spawnBurst(G, b.x, b.y, '#c9c9c9', 4, 140, 0.3);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const ped of [...G.peds]) {
        if (dist(b.x, b.y, ped.x, ped.y) < 14) {
          damagePed(G, ped, b.damage);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of G.cops) {
          if (dist(b.x, b.y, cop.x, cop.y) < 14) {
            cop.hp -= b.damage;
            spawnBurst(G, cop.x, cop.y, '#ff5a5a', 8, 200, 0.4);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of G.cars) {
          if (car.kind === 'player') continue;
          if (dist(b.x, b.y, car.x, car.y) < 26) {
            car.hp -= b.damage;
            spawnBurst(G, b.x, b.y, '#ffd23a', 6, 180, 0.3);
            if (car.hp <= 0 && car.kind === 'traffic') {
              spawnBurst(G, car.x, car.y, '#ff7a3a', 26, 380, 0.8);
              G.cars.splice(G.cars.indexOf(car), 1);
              addHeat(G, 6, 'A car was destroyed');
            }
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'cop') {
      const p = G.player;
      if (!p.car && dist(b.x, b.y, p.x, p.y) < 13) {
        damagePlayer(G, b.damage, 'police');
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function damagePlayer(G, amount, source) {
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
  shake(G, 3);
  if (p.hp <= 0) {
    p.hp = 0;
    wastePlayer(G);
  }
}

export function spawnPickups(G) {
  const spots = [
    { kind: 'cash', x: 340, y: 340 }, { kind: 'cash', x: 1120, y: 480 },
    { kind: 'cash', x: 1960, y: 260 }, { kind: 'cash', x: 2680, y: 720 },
    { kind: 'cash', x: 520, y: 1620 }, { kind: 'cash', x: 1560, y: 1980 },
    { kind: 'cash', x: 2360, y: 1120 }, { kind: 'cash', x: 2900, y: 1960 },
    { kind: 'cash', x: 880, y: 1120 }, { kind: 'cash', x: 2080, y: 1680 },
    { kind: 'cash', x: 1240, y: 760 }, { kind: 'cash', x: 760, y: 2020 },
    { kind: 'health', x: 1620, y: 480 }, { kind: 'health', x: 2280, y: 1480 },
    { kind: 'health', x: 980, y: 1880 }, { kind: 'armor', x: 2080, y: 820 },
    { kind: 'armor', x: 620, y: 1300 }, { kind: 'ammo', x: 1820, y: 1240 },
    { kind: 'ammo', x: 2620, y: 420 }, { kind: 'smg', x: 2960, y: 1420 },
  ];
  for (const s of spots) {
    G.pickups.push({ ...s, taken: false, bob: G.rng.range(0, Math.PI * 2) });
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.bob += dt * 3;
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      G.audio.pickup();
      if (pk.kind === 'cash') {
        p.cash += 150;
        G.stats.stashes += 1;
        addFloatText(G, pk.x, pk.y - 20, '+$150 stash', '#37d67a');
      } else if (pk.kind === 'health') {
        p.hp = clamp(p.hp + 50, 0, 100);
        addFloatText(G, pk.x, pk.y - 20, '+50 health', '#7ad98a');
      } else if (pk.kind === 'armor') {
        p.armor = clamp(p.armor + 50, 0, 100);
        addFloatText(G, pk.x, pk.y - 20, '+50 armor', '#7ab8d9');
      } else if (pk.kind === 'ammo') {
        p.ammoReserve += 36;
        addFloatText(G, pk.x, pk.y - 20, '+36 ammo', '#e8d44d');
      } else if (pk.kind === 'smg') {
        p.weapons.smg = true;
        p.weapon = 'smg';
        p.ammoInMag = 30;
        p.ammoReserve += 60;
        addFloatText(G, pk.x, pk.y - 20, 'SMG acquired!', '#e8a34d');
      }
    }
  }
}

export function drawPickups(ctx, G, time) {
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const bobY = Math.sin(pk.bob) * 4;
    const colors = { cash: '#37d67a', health: '#ff6a6a', armor: '#5aa8e0', ammo: '#e8d44d', smg: '#e08a3a' };
    const labels = { cash: '$', health: '+', armor: 'A', ammo: '»', smg: 'S' };
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 10, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors[pk.kind];
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bobY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0b1a10';
    ctx.font = 'bold 13px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(labels[pk.kind], pk.x, pk.y + bobY + 5);
  }
}

export function drawBullets(ctx, G) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
