// Drawing only: the city, the cars, the people and the effects, seen through a
// camera that follows the hero. All painting goes through a tiny helper (box,
// disc, poly, text) so the scene code reads like a sketch. The day clock
// tints the scene: bright noon, orange sunset, dark neon night with lit
// windows and a headlight glow. The camera pulls back a little at speed, so
// fast driving shows more road ahead.
import { CFG, PALETTE, SPOTS } from './tuning.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function daylight(timeSeconds) {
  // Seconds since midnight -> {day: 0..1, tint}.
  const hour = (timeSeconds / 3600) % 24;
  if (hour >= 6 && hour < 17) return { day: 1, tint: 'rgba(255,244,214,0.06)' };
  if (hour >= 17 && hour < 19.5) return { day: 0.82, tint: 'rgba(255,130,50,0.11)' };
  if (hour >= 19.5 || hour < 5.5) return { day: 0.15, tint: 'rgba(10,16,60,0.42)' };
  return { day: 0.6, tint: 'rgba(255,170,90,0.10)' };
}

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fontCache = new Map();

  // The painter: every shape the scene needs, in one place.
  const P = {
    box(x, y, w, h, fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
    },
    disc(x, y, r, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },
    ring(x, y, r, stroke, width) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    },
    poly(points, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fill();
    },
    text(value, x, y, size, color, align, weight) {
      const key = `${size}:${weight || ''}`;
      if (!fontCache.has(key)) {
        fontCache.set(key, `${weight ? `${weight} ` : ''}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`);
      }
      ctx.font = fontCache.get(key);
      ctx.fillStyle = color;
      ctx.textAlign = align || 'left';
      ctx.fillText(value, x, y);
    },
  };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function drawGround(state) {
    const { cam } = state;
    const l = cam.x - VIEW_W / 2 - 40;
    const t = cam.y - VIEW_H / 2 - 40;
    const r = cam.x + VIEW_W / 2 + 40;
    const b = cam.y + VIEW_H / 2 + 40;
    P.box(l, t, r - l, b - t, PALETTE.lawn);
    // Mow stripes.
    for (let y = Math.floor(t / 120) * 120; y < b; y += 240) {
      P.box(l, y, r - l, 120, PALETTE.lawn2);
    }
    // Plaza, docks and the ferry pier.
    for (const zone of state.city.zones) {
      if (zone.kind === 'plaza') P.box(zone.x, zone.y, zone.w, zone.h, PALETTE.park);
      else if (zone.kind === 'docks') P.box(zone.x, zone.y, zone.w, zone.h, '#8a7a5a');
      else if (zone.kind === 'pier') {
        P.box(zone.x, zone.y, zone.w, zone.h, '#8a6a42');
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        for (let x = zone.x + 24; x < zone.x + zone.w; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, zone.y + 2);
          ctx.lineTo(x, zone.y + zone.h - 2);
          ctx.stroke();
        }
      }
    }
    // Sand, sea, surf.
    P.box(Math.max(l, CFG.sandX), t, Math.min(r, CFG.seaX) - Math.max(l, CFG.sandX), b - t, PALETTE.sand);
    const wave = Math.sin(state.elapsed * 1.4) * 6;
    P.box(Math.max(l, CFG.seaX), t, r - Math.max(l, CFG.seaX), b - t, PALETTE.sea);
    for (let y = Math.floor(t / 90) * 90; y < b; y += 90) {
      P.box(Math.max(l, CFG.seaX + 60), y, r - Math.max(l, CFG.seaX + 60), 26, PALETTE.sea2);
    }
    P.box(Math.max(l, CFG.seaX - 4), t, 5, b - t, 'rgba(255,255,255,0.55)');
    P.box(Math.max(l, CFG.seaX + 26 + wave), t, 3, b - t, 'rgba(255,255,255,0.55)');
    // Streets.
    for (const sx of CFG.streetsX) P.box(sx - CFG.streetW / 2, t, CFG.streetW, b - t, PALETTE.asphalt);
    for (const sy of CFG.streetsY) P.box(l, sy - CFG.streetW / 2, r - l, CFG.streetW, PALETTE.asphalt);
    // Kerbs.
    ctx.strokeStyle = PALETTE.kerb;
    ctx.lineWidth = 5;
    for (const sx of CFG.streetsX) {
      ctx.beginPath();
      ctx.moveTo(sx - CFG.streetW / 2 - 3, t); ctx.lineTo(sx - CFG.streetW / 2 - 3, b);
      ctx.moveTo(sx + CFG.streetW / 2 + 3, t); ctx.lineTo(sx + CFG.streetW / 2 + 3, b);
      ctx.stroke();
    }
    for (const sy of CFG.streetsY) {
      ctx.beginPath();
      ctx.moveTo(l, sy - CFG.streetW / 2 - 3); ctx.lineTo(r, sy - CFG.streetW / 2 - 3);
      ctx.moveTo(l, sy + CFG.streetW / 2 + 3); ctx.lineTo(r, sy + CFG.streetW / 2 + 3);
      ctx.stroke();
    }
    // Centre dashes and crosswalks.
    for (const sx of CFG.streetsX) {
      for (let y = Math.floor(t / 64) * 64; y < b; y += 64) P.box(sx - 2, y, 4, 30, PALETTE.lane);
    }
    for (const sy of CFG.streetsY) {
      for (let x = Math.floor(l / 64) * 64; x < r; x += 64) P.box(x, sy - 2, 30, 4, PALETTE.lane);
    }
    for (const sx of CFG.streetsX) {
      for (const sy of CFG.streetsY) {
        for (let i = -3; i <= 3; i += 1) P.box(sx + i * 12 - 4, sy - CFG.streetW / 2 + 8, 8, 18, 'rgba(255,255,255,0.75)');
      }
    }
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,24,0.5)';
    ctx.lineWidth = 4;
    for (const mark of state.fx.skids) {
      ctx.globalAlpha = Math.min(0.6, mark.ttl / 5);
      ctx.beginPath();
      ctx.moveTo(mark.x - Math.cos(mark.angle) * 16, mark.y - Math.sin(mark.angle) * 16);
      ctx.lineTo(mark.x + Math.cos(mark.angle) * 16, mark.y + Math.sin(mark.angle) * 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBuildings(state, night) {
    const { cam } = state;
    const l = cam.x - VIEW_W / 2 - 80;
    const t = cam.y - VIEW_H / 2 - 80;
    const r = cam.x + VIEW_W / 2 + 80;
    const b = cam.y + VIEW_H / 2 + 80;
    const seen = (o) => o.x + o.w > l && o.x < r && o.y + o.h > t && o.y < b;
    for (const c of state.city.crates) {
      if (!seen(c)) continue;
      P.box(c.x + 5, c.y + 6, c.w, c.h, 'rgba(0,0,0,0.25)');
      P.box(c.x, c.y, c.w, c.h, c.color);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(c.x + (c.w / 5) * i, c.y);
        ctx.lineTo(c.x + (c.w / 5) * i, c.y + c.h);
        ctx.stroke();
      }
    }
    for (const bd of state.city.buildings) {
      if (!seen(bd)) continue;
      // Shadow offset gives the roofs height.
      P.box(bd.x + 8, bd.y + 10, bd.w, bd.h, 'rgba(0,0,0,0.28)');
      P.box(bd.x, bd.y, bd.w, bd.h, bd.wall);
      P.box(bd.x + 5, bd.y + 5, bd.w - 10, bd.h - 10, bd.roof);
      // Roof clutter: vents, and a pool on the towers.
      P.box(bd.x + 12, bd.y + 12, 18, 12, 'rgba(0,0,0,0.18)');
      P.box(bd.x + bd.w - 34, bd.y + bd.h - 26, 22, 14, 'rgba(0,0,0,0.18)');
      if (bd.tower) {
        ctx.fillStyle = '#3fb7c9';
        ctx.beginPath();
        ctx.ellipse(bd.x + bd.w / 2, bd.y + bd.h / 2, 26, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (bd.neon) {
        P.box(bd.x + 8, bd.y + bd.h - 12, 46, 6, PALETTE.pink);
        P.box(bd.x + bd.w - 54, bd.y + 8, 46, 6, PALETTE.cyan);
      }
      // Windows: dark by day, warm and lit at night.
      const cw = (bd.w - 10) / bd.cols;
      const ch = (bd.h - 10) / bd.rows;
      for (const win of bd.lit) {
        const wx = bd.x + 5 + win.cx * cw + cw * 0.22;
        const wy = bd.y + 5 + win.cy * ch + ch * 0.22;
        P.box(wx, wy, cw * 0.56, ch * 0.56,
          night ? (win.warm ? '#ffd98a' : '#9fd8ff') : 'rgba(20,30,44,0.55)');
      }
    }
    // Palms.
    for (const palm of state.city.palms) {
      if (palm.x < l || palm.x > r || palm.y < t || palm.y > b) continue;
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 3, palm.y - 12);
      ctx.stroke();
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.fillStyle = PALETTE.palm;
        ctx.beginPath();
        ctx.ellipse(palm.x + 3 + Math.cos(a) * 10, palm.y - 14 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Place labels.
    for (const key of Object.keys(SPOTS)) {
      const place = SPOTS[key];
      if (place.x < l || place.x > r || place.y < t || place.y > b) continue;
      P.text(place.label, place.x, place.y - 46, 13, 'rgba(255,255,255,0.85)', 'center', '600');
    }
  }

  function drawCar(car, isHero) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    P.box(-28 + 4, -13 + 5, 56, 27, 'rgba(0,0,0,0.30)'); // shadow
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-28, -13, 56, 26, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,24,32,0.85)'; // cabin
    ctx.beginPath();
    ctx.roundRect(-8, -11, 18, 22, 5);
    ctx.fill();
    P.box(6, -10, 4, 20, 'rgba(160,210,235,0.7)'); // windshield
    P.box(26, -11, 3, 6, '#fff7c0'); // headlights
    P.box(26, 5, 3, 6, '#fff7c0');
    P.box(-29, -11, 3, 6, '#ff3b30'); // taillights
    P.box(-29, 5, 3, 6, '#ff3b30');
    if (car.kind === 'police') {
      const flash = Math.floor(Date.now() / 280) % 2 === 0;
      P.box(-4, -13, 8, 4, flash ? '#ff2e4d' : '#2e7dff');
      P.text('MPD', 0, 2, 9, '#ffffff', 'center', '700');
    }
    if (car.cab) P.text('TAXI', -16, 2, 8, '#111111', 'center', '700');
    if (car.hornT > 0) {
      // Horn blast: little sound rings off the nose of the car.
      ctx.strokeStyle = 'rgba(255,210,62,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(34, 0, 8 + (0.6 - car.hornT) * 30, -0.9, 0.9);
      ctx.stroke();
    }
    if (isHero) {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-31, -16, 62, 32, 9);
      ctx.stroke();
    }
    if (car.health < 45) {
      P.disc(-14 + Math.random() * 8, -4 + Math.random() * 8, 5 + Math.random() * 3, 'rgba(60,60,60,0.5)');
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, isHero, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; // shadow
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    P.disc(0, 0, 11, color); // body
    P.disc(4, 0, 6, '#f2c89b'); // head
    P.disc(9, 0, 2.5, '#1d1d24'); // facing tick
    if (isHero) P.ring(0, 0, 15, '#ffd23e', 2);
    ctx.restore();
  }

  function drawEffects(state) {
    for (const p of state.fx.sparks) {
      ctx.globalAlpha = Math.max(0, p.ttl / p.max);
      P.box(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.color);
    }
    ctx.globalAlpha = 1;
    for (const b of state.fx.shots) P.box(b.x - 4, b.y - 1.5, 8, 3, '#ffe66d');
    // Hidden packages: pulsing gold stars.
    const pulse = 0.7 + Math.sin(state.elapsed * 4) * 0.3;
    for (const pkg of state.city.packages) {
      if (pkg.taken) continue;
      ctx.save();
      ctx.translate(pkg.x, pkg.y);
      ctx.globalAlpha = pulse;
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? 13 : 6;
        points.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      P.poly(points, '#ffd23e');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Pickups: health, armor, ammo.
    for (const item of state.loot) {
      if (item.taken) continue;
      if (item.kind === 'ammo') {
        P.box(item.x - 11, item.y - 8, 22, 16, '#3a7ca5');
        P.text('AMMO', item.x, item.y + 5, 9, '#ffffff', 'center', '800');
      } else {
        P.disc(item.x, item.y, 13, item.kind === 'health' ? '#ff5d5d' : '#4a90d9');
        P.text(item.kind === 'health' ? '+' : 'A', item.x, item.y + 6, 16, '#ffffff', 'center', '700');
      }
    }
    // Floating notes.
    for (const n of state.fx.notes) {
      ctx.globalAlpha = Math.min(1, n.ttl);
      P.text(n.text, n.x, n.y, 15, n.color, 'center', '700');
    }
    ctx.globalAlpha = 1;
  }

  function drawMarker(state) {
    const job = state.jobs.current();
    const step = state.jobs.step();
    const fare = state.jobs.state.fare;
    let target = null;
    let color = '#ffd23e';
    if (fare) {
      target = fare.to;
      color = '#7ac74f';
    } else if (step) {
      target = { x: step.x, y: step.y };
    }
    if (!target) return;
    const bob = Math.sin(state.elapsed * 3) * 6;
    ctx.save();
    ctx.translate(target.x, target.y + bob - 26);
    P.poly([[0, 18], [-13, -8], [13, -8]], color);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    P.ring(target.x, target.y, 34 + Math.sin(state.elapsed * 3) * 5, color, 3);
  }

  /** Headlight cone ahead of a car at night, drawn additively. */
  function drawHeadlights(state, night) {
    if (!night) return;
    const hero = state.hero;
    const car = hero.inCar ? hero.car : null;
    if (!car) return;
    const a = car.angle;
    const nx = car.x + Math.cos(a) * 30;
    const ny = car.y + Math.sin(a) * 30;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(nx, ny, 8, nx, ny, 260);
    grad.addColorStop(0, 'rgba(255,240,180,0.22)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.arc(nx, ny, 260, a - 0.42, a + 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Paint the world (no HUD): camera transform, ground, buildings, entities, tint. */
  function drawWorld(state) {
    const { cam, hero } = state;
    // The faster the hero moves, the further the camera pulls back.
    const zoom = 1 - Math.min(0.12, Math.abs(hero.speed || 0) / 4200);
    const scale = view.scale * 0.92 * zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    P.box(0, 0, canvas.width, canvas.height, '#101623');
    ctx.setTransform(scale, 0, 0, scale, canvas.width / 2 - cam.x * scale, canvas.height / 2 - cam.y * scale);
    const light = daylight(state.time);
    const night = light.day < 0.4;
    drawGround(state);
    drawBuildings(state, night);
    drawMarker(state);
    for (const car of state.cars.list) {
      if (car === hero.car) continue;
      drawCar(car, false);
    }
    if (hero.inCar && hero.car) drawCar(hero.car, true);
    for (const w of state.people.list) {
      drawPerson(w.x, w.y, w.angle, w.color, false, w.mode === 'down');
      if (w.mode === 'fare') P.text('$', w.x, w.y - 22, 14, '#7ac74f', 'center', '800');
    }
    for (const officer of state.police.officers) {
      drawPerson(officer.x, officer.y, officer.angle, '#14264d', false, false);
      P.text('MPD', officer.x, officer.y - 16, 8, '#ffffff', 'center', '700');
    }
    if (!hero.inCar) {
      drawPerson(hero.x, hero.y, hero.weapon === 'pistol' ? hero.aim : hero.angle, '#ff6b81', true, false);
      if (hero.weapon === 'pistol') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hero.x + Math.cos(hero.aim) * 18, hero.y + Math.sin(hero.aim) * 18);
        ctx.lineTo(hero.x + Math.cos(hero.aim) * 120, hero.y + Math.sin(hero.aim) * 120);
        ctx.stroke();
      }
    }
    drawEffects(state);
    drawHeadlights(state, night);
    // Day/night tint + headlight glow at night.
    P.box(cam.x - VIEW_W / 2 - 60, cam.y - VIEW_H / 2 - 60, VIEW_W + 120, VIEW_H + 120, light.tint);
    if (night) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(hero.x, hero.y, 10, hero.x, hero.y, 260);
      glow.addColorStop(0, 'rgba(255,240,180,0.20)');
      glow.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(hero.x - 260, hero.y - 260, 520, 520);
      ctx.restore();
    }
    // Remember the camera for pointer aiming and the HUD (in CSS pixels).
    state.cam.scale = scale / (window.devicePixelRatio || 1);
    state.cam.screenW = canvas.width / (window.devicePixelRatio || 1);
    state.cam.screenH = canvas.height / (window.devicePixelRatio || 1);
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawWorld, text: P.text, view, daylight };
}
