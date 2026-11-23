// Particles, floating score text and screen shake. Pure presentation: no
// gameplay state lives here beyond the effect lists themselves.

export function spawnBurst(G, x, y, color, count, speed = 220, life = 0.6) {
  for (let i = 0; i < count; i++) {
    const a = G.rng.range(0, Math.PI * 2);
    const s = G.rng.range(speed * 0.3, speed);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: G.rng.range(life * 0.5, life),
      maxLife: life,
      color, size: G.rng.range(2, 5),
    });
  }
}

export function spawnSmoke(G, x, y, count = 6) {
  for (let i = 0; i < count; i++) {
    G.particles.push({
      x: x + G.rng.range(-8, 8), y: y + G.rng.range(-8, 8),
      vx: G.rng.range(-20, 20), vy: G.rng.range(-50, -10),
      life: G.rng.range(0.6, 1.2), maxLife: 1.2,
      color: '#9aa0a6', size: G.rng.range(6, 12),
    });
  }
}

export function addFloatText(G, x, y, text, color = '#ffffff') {
  G.floatTexts.push({ x, y, text, color, life: 1.4 });
}

export function shake(G, amount) {
  G.shake = Math.min(18, G.shake + amount);
}

export function updateFx(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= dt;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.floatTexts.length - 1; i >= 0; i--) {
    const t = G.floatTexts[i];
    t.y -= 34 * dt;
    t.life -= dt;
    if (t.life <= 0) G.floatTexts.splice(i, 1);
  }
  G.shake = Math.max(0, G.shake - 40 * dt);
}

export function drawFx(ctx, G) {
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * (p.life / p.maxLife)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px Verdana, sans-serif';
  for (const t of G.floatTexts) {
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
