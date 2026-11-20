// Combat: bullets, melee swings and the particles they leave behind. Bullets are
// simple point projectiles; melee is a short arc in front of the player. Both report
// their hits through the callbacks the world passes in.
import { PLAYER } from './config.js';

export function createCombat() {
  const bullets = [];
  const particles = [];
  const floaters = []; // floating "+$50" style text

  function shoot(x, y, angle, friendly) {
    bullets.push({
      x: x + Math.cos(angle) * 22,
      y: y + Math.sin(angle) * 22,
      vx: Math.cos(angle) * 900,
      vy: Math.sin(angle) * 900,
      life: 0.9,
      friendly,
    });
    burst(x + Math.cos(angle) * 24, y + Math.sin(angle) * 24, 3, '#ffd23e', 120);
  }

  function burst(x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45, max: 0.45, color, size: 3 });
    }
  }

  function floater(x, y, text, color) {
    floaters.push({ x, y, text, color: color || '#ffd23e', life: 1.4 });
  }

  /** Punch: hits the nearest enemy in front of the player within range. */
  function punch(px, py, angle, targets) {
    burst(px + Math.cos(angle) * 26, py + Math.sin(angle) * 26, 4, '#ffffff', 160);
    let best = null;
    let bestDist = PLAYER.punchRange;
    for (const t of targets) {
      if (t.health <= 0 || t.state === 'down') continue;
      const dx = t.x - px;
      const dy = t.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist > PLAYER.punchRange) continue;
      const facing = Math.cos(Math.atan2(dy, dx) - angle);
      if (facing < 0.3) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    if (best) {
      best.health -= PLAYER.punchDamage;
      burst(best.x, best.y, 6, '#ff5d5d', 200);
      if (best.health <= 0) best.state = 'down';
      return best;
    }
    return null;
  }

  function step(dt, city, hitEnemy, hitPlayer) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || city.blocked(b.x, b.y, 2)) {
        if (city.blocked(b.x, b.y, 2)) burst(b.x, b.y, 3, '#cccccc', 90);
        bullets.splice(i, 1);
        continue;
      }
      const hit = (b.friendly ? hitEnemy : hitPlayer)(b.x, b.y);
      if (hit) {
        burst(b.x, b.y, 5, '#ff5d5d', 180);
        bullets.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

  return { bullets, particles, floaters, shoot, burst, floater, punch, step };
}
