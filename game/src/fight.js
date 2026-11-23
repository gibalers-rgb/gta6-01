// Combat: bullets, melee swings and the particles they leave behind. Bullets
// are point projectiles with a short fuse; melee is a short arc in front of
// the player. Hits are reported through the callbacks the world passes in.
import { CFG } from './tuning.js';

export function makeFight() {
  const shots = [];
  const sparks = [];
  const notes = []; // floating "+$50" style text
  const skids = []; // handbrake tyre marks {x, y, angle, ttl}

  function fire(x, y, angle, friendly) {
    shots.push({
      x: x + Math.cos(angle) * 22,
      y: y + Math.sin(angle) * 22,
      vx: Math.cos(angle) * 900,
      vy: Math.sin(angle) * 900,
      ttl: 0.9,
      friendly,
    });
    burst(x + Math.cos(angle) * 24, y + Math.sin(angle) * 24, 3, '#ffd23e', 120);
  }

  function burst(x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, ttl: 0.45, max: 0.45, color, size: 3 });
    }
  }

  function note(x, y, text, color) {
    notes.push({ x, y, text, color: color || '#ffd23e', ttl: 1.4 });
  }

  function skidMark(x, y, angle) {
    skids.push({ x, y, angle, ttl: 5 });
    if (skids.length > 220) skids.shift();
  }

  /** Punch: the nearest enemy in front of the player, inside the arc. */
  function punch(px, py, angle, targets) {
    burst(px + Math.cos(angle) * 26, py + Math.sin(angle) * 26, 4, '#ffffff', 160);
    let best = null;
    let bestD = CFG.hero.fistReach;
    for (const t of targets) {
      if (t.health <= 0 || t.mode === 'down') continue;
      const dx = t.x - px;
      const dy = t.y - py;
      const d = Math.hypot(dx, dy);
      if (d > CFG.hero.fistReach) continue;
      const facing = Math.cos(Math.atan2(dy, dx) - angle);
      if (facing < 0.3) continue;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best) {
      best.health -= CFG.hero.fistDmg;
      burst(best.x, best.y, 6, '#ff5d5d', 200);
      if (best.health <= 0) best.mode = 'down';
      return best;
    }
    return null;
  }

  function tick(dt, city, hitFoe, hitHero) {
    for (let i = shots.length - 1; i >= 0; i -= 1) {
      const b = shots[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      // A fading tracer glint trailing each bullet, so gunfire reads at a
      // glance even at the edge of the screen.
      if (Math.random() < 0.5) {
        sparks.push({ x: b.x, y: b.y, vx: 0, vy: 0, ttl: 0.12, max: 0.12, color: '#ffe66d', size: 2 });
      }
      if (b.ttl <= 0 || city.blocked(b.x, b.y, 2)) {
        if (city.blocked(b.x, b.y, 2)) burst(b.x, b.y, 3, '#cccccc', 90);
        shots.splice(i, 1);
        continue;
      }
      const hit = (b.friendly ? hitFoe : hitHero)(b.x, b.y);
      if (hit) {
        burst(b.x, b.y, 5, '#ff5d5d', 180);
        shots.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const p = sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.ttl -= dt;
      if (p.ttl <= 0) sparks.splice(i, 1);
    }
    for (let i = notes.length - 1; i >= 0; i -= 1) {
      const n = notes[i];
      n.y -= 34 * dt;
      n.ttl -= dt;
      if (n.ttl <= 0) notes.splice(i, 1);
    }
    for (let i = skids.length - 1; i >= 0; i -= 1) {
      skids[i].ttl -= dt;
      if (skids[i].ttl <= 0) skids.splice(i, 1);
    }
  }

  return { shots, sparks, notes, skids, fire, burst, note, skidMark, punch, tick };
}
