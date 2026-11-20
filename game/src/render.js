// Drawing only: the city, the cars, the people and the effects, seen through a
// camera that follows the player. The day clock tints the scene: bright noon,
// orange sunset, dark neon night with headlight cones.
import { BEACH_X, COLORS, DAY_LENGTH, OCEAN_X, PLACES, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { isOnRoad, isSand, isWater } from './city.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function lightFor(timeSeconds) {
  // timeSeconds is seconds since midnight; returns {day: 0..1, tint, sky}.
  const hour = (timeSeconds / 3600) % 24;
  if (hour >= 6 && hour < 17) return { day: 1, tint: 'rgba(255,244,214,0.06)', sun: 1 };
  if (hour >= 17 && hour < 19.5) return { day: 0.75, tint: 'rgba(255,120,40,0.16)', sun: 0.7 };
  if (hour >= 19.5 || hour < 5.5) return { day: 0.15, tint: 'rgba(10,16,60,0.42)', sun: 0 };
  return { day: 0.6, tint: 'rgba(255,170,90,0.10)', sun: 0.5 };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function drawGround(state) {
    const { cam } = state;
    const left = cam.x - VIEW_W / 2 - 40;
    const top = cam.y - VIEW_H / 2 - 40;
    const right = cam.x + VIEW_W / 2 + 40;
    const bottom = cam.y + VIEW_H / 2 + 40;
    // Grass base.
    context.fillStyle = COLORS.grass;
    context.fillRect(left, top, right - left, bottom - top);
    // Mow stripes for texture.
    context.fillStyle = COLORS.grassDark;
    for (let y = Math.floor(top / 120) * 120; y < bottom; y += 240) {
      context.fillRect(left, y, right - left, 120);
    }
    // Park zones.
    for (const zone of state.city.zones) {
      if (zone.kind === 'park') {
        context.fillStyle = COLORS.park;
        context.fillRect(zone.x, zone.y, zone.w, zone.h);
      } else {
        context.fillStyle = '#8a7a5a';
        context.fillRect(zone.x, zone.y, zone.w, zone.h);
      }
    }
    // Sand and ocean.
    context.fillStyle = COLORS.sand;
    context.fillRect(Math.max(left, BEACH_X), top, Math.min(right, OCEAN_X) - Math.max(left, BEACH_X), bottom - top);
    const wave = Math.sin(state.elapsed * 1.4) * 6;
    context.fillStyle = COLORS.ocean;
    context.fillRect(Math.max(left, OCEAN_X), top, right - Math.max(left, OCEAN_X), bottom - top);
    context.fillStyle = COLORS.oceanDeep;
    for (let y = Math.floor(top / 90) * 90; y < bottom; y += 90) {
      context.fillRect(Math.max(left, OCEAN_X + 60), y, right - Math.max(left, OCEAN_X + 60), 26);
    }
    context.fillStyle = 'rgba(255,255,255,0.55)';
    context.fillRect(Math.max(left, OCEAN_X - 4), top, 5, bottom - top);
    context.fillRect(Math.max(left, OCEAN_X + 26 + wave), top, 3, bottom - top);
    // Roads.
    context.fillStyle = COLORS.road;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_WIDTH / 2, top, ROAD_WIDTH, bottom - top);
    for (const ry of ROADS_Y) context.fillRect(left, ry - ROAD_WIDTH / 2, right - left, ROAD_WIDTH);
    // Sidewalk edges.
    context.strokeStyle = COLORS.sidewalk;
    context.lineWidth = 5;
    for (const rx of ROADS_X) {
      context.beginPath();
      context.moveTo(rx - ROAD_WIDTH / 2 - 3, top);
      context.lineTo(rx - ROAD_WIDTH / 2 - 3, bottom);
      context.moveTo(rx + ROAD_WIDTH / 2 + 3, top);
      context.lineTo(rx + ROAD_WIDTH / 2 + 3, bottom);
      context.stroke();
    }
    for (const ry of ROADS_Y) {
      context.beginPath();
      context.moveTo(left, ry - ROAD_WIDTH / 2 - 3);
      context.lineTo(right, ry - ROAD_WIDTH / 2 - 3);
      context.moveTo(left, ry + ROAD_WIDTH / 2 + 3);
      context.lineTo(right, ry + ROAD_WIDTH / 2 + 3);
      context.stroke();
    }
    // Centre dashes.
    context.fillStyle = COLORS.line;
    for (const rx of ROADS_X) {
      for (let y = Math.floor(top / 64) * 64; y < bottom; y += 64) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = Math.floor(left / 64) * 64; x < right; x += 64) context.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalks at intersections.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -3; i <= 3; i += 1) context.fillRect(rx + i * 12 - 4, ry - ROAD_WIDTH / 2 + 8, 8, 18);
      }
    }
  }

  function drawBuildings(state) {
    const { cam } = state;
    const left = cam.x - VIEW_W / 2 - 80;
    const top = cam.y - VIEW_H / 2 - 80;
    const right = cam.x + VIEW_W / 2 + 80;
    const bottom = cam.y + VIEW_H / 2 + 80;
    const inView = (b) => b.x + b.w > left && b.x < right && b.y + b.h > top && b.y < bottom;
    for (const c of state.city.containers) {
      if (!inView(c)) continue;
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(c.x + 5, c.y + 6, c.w, c.h);
      context.fillStyle = c.color;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 2;
      for (let i = 1; i < 5; i += 1) {
        context.beginPath();
        context.moveTo(c.x + (c.w / 5) * i, c.y);
        context.lineTo(c.x + (c.w / 5) * i, c.y + c.h);
        context.stroke();
      }
    }
    for (const b of state.city.buildings) {
      if (!inView(b)) continue;
      // Shadow offset gives the roofs height.
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      context.fillStyle = b.wall;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Roof details: vents and a pool on the tall ones.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 12, b.y + 12, 18, 12);
      context.fillRect(b.x + b.w - 34, b.y + b.h - 26, 22, 14);
      if (b.tall) {
        context.fillStyle = '#3fb7c9';
        context.beginPath();
        context.ellipse(b.x + b.w / 2, b.y + b.h / 2, 26, 16, 0, 0, Math.PI * 2);
        context.fill();
      }
      if (b.neon) {
        context.fillStyle = COLORS.neonPink;
        context.fillRect(b.x + 8, b.y + b.h - 12, 46, 6);
        context.fillStyle = COLORS.neonCyan;
        context.fillRect(b.x + b.w - 54, b.y + 8, 46, 6);
      }
    }
    // Palm trees.
    for (const palm of state.city.palms) {
      if (palm.x < left || palm.x > right || palm.y < top || palm.y > bottom) continue;
      context.strokeStyle = '#7a5a34';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + 3, palm.y - 12);
      context.stroke();
      context.fillStyle = COLORS.palm;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        context.beginPath();
        context.ellipse(palm.x + 3 + Math.cos(a) * 10, palm.y - 14 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Place labels.
    context.textAlign = 'center';
    for (const key of Object.keys(PLACES)) {
      const place = PLACES[key];
      if (place.x < left || place.x > right || place.y < top || place.y > bottom) continue;
      text(place.label, place.x, place.y - 46, 13, 'rgba(255,255,255,0.85)', 'center', '600');
    }
  }

  function drawCar(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.30)';
    context.fillRect(-28 + 4, -13 + 5, 56, 27);
    // Body.
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-28, -13, 56, 26, 8);
    context.fill();
    // Cabin and windshield.
    context.fillStyle = 'rgba(20,24,32,0.85)';
    context.beginPath();
    context.roundRect(-8, -11, 18, 22, 5);
    context.fill();
    context.fillStyle = 'rgba(160,210,235,0.7)';
    context.fillRect(6, -10, 4, 20);
    // Headlights.
    context.fillStyle = '#fff7c0';
    context.fillRect(26, -11, 3, 6);
    context.fillRect(26, 5, 3, 6);
    // Taillights.
    context.fillStyle = '#ff3b30';
    context.fillRect(-29, -11, 3, 6);
    context.fillRect(-29, 5, 3, 6);
    if (car.kind === 'police') {
      const flash = Math.floor(Date.now() / 280) % 2 === 0;
      context.fillStyle = flash ? '#ff2e4d' : '#2e7dff';
      context.fillRect(-4, -13, 8, 4);
      context.fillStyle = '#ffffff';
      context.font = '700 9px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('LCPD', 0, 2);
    }
    if (car.taxi) {
      context.fillStyle = '#111111';
      context.font = '700 8px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('TAXI', -16, 2);
    }
    if (isPlayer) {
      context.strokeStyle = '#ffd23e';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-31, -16, 62, 32, 9);
      context.stroke();
    }
    if (car.health < 45) {
      context.fillStyle = 'rgba(60,60,60,0.5)';
      context.beginPath();
      context.arc(-14 + Math.random() * 8, -4 + Math.random() * 8, 5 + Math.random() * 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, isPlayer, down) {
    context.save();
    context.translate(x, y);
    if (down) {
      context.rotate(Math.PI / 2);
      context.fillStyle = color;
      context.beginPath();
      context.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
    context.fill();
    // Body and head.
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c89b';
    context.beginPath();
    context.arc(4, 0, 6, 0, Math.PI * 2);
    context.fill();
    // Facing tick.
    context.fillStyle = '#1d1d24';
    context.beginPath();
    context.arc(9, 0, 2.5, 0, Math.PI * 2);
    context.fill();
    if (isPlayer) {
      context.strokeStyle = '#ffd23e';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, 15, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function drawEffects(state) {
    for (const p of state.combat.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    for (const b of state.combat.bullets) {
      context.fillStyle = '#ffe66d';
      context.fillRect(b.x - 4, b.y - 1.5, 8, 3);
    }
    // Hidden packages: pulsing gold stars.
    const pulse = 0.7 + Math.sin(state.elapsed * 4) * 0.3;
    for (const pkg of state.city.packages) {
      if (pkg.taken) continue;
      context.save();
      context.translate(pkg.x, pkg.y);
      context.globalAlpha = pulse;
      context.fillStyle = '#ffd23e';
      context.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 13 : 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.restore();
    }
    context.globalAlpha = 1;
    // Pickups.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      context.fillStyle = pickup.kind === 'health' ? '#ff5d5d' : '#4a90d9';
      context.beginPath();
      context.arc(pickup.x, pickup.y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = '700 16px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText(pickup.kind === 'health' ? '+' : 'A', pickup.x, pickup.y + 6);
    }
    // Floaters.
    context.font = '700 15px system-ui, sans-serif';
    context.textAlign = 'center';
    for (const f of state.combat.floaters) {
      context.globalAlpha = Math.min(1, f.life);
      context.fillStyle = f.color;
      context.fillText(f.text, f.x, f.y);
    }
    context.globalAlpha = 1;
  }

  function drawObjectiveMarker(state) {
    const mission = state.missions.current();
    const obj = state.missions.objective();
    const taxi = state.missions.state.taxi;
    let target = null;
    let color = '#ffd23e';
    if (taxi) {
      target = taxi.to;
      color = '#7ac74f';
    } else if (obj) {
      target = { x: obj.x, y: obj.y };
    }
    if (!target) return;
    const bob = Math.sin(state.elapsed * 3) * 6;
    context.save();
    context.translate(target.x, target.y + bob - 26);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, 18);
    context.lineTo(-13, -8);
    context.lineTo(13, -8);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.4)';
    context.lineWidth = 2;
    context.stroke();
    context.restore();
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(target.x, target.y, 34 + Math.sin(state.elapsed * 3) * 5, 0, Math.PI * 2);
    context.stroke();
  }

  /** Paint the world (no HUD): camera transform, ground, buildings, entities, tint. */
  function drawWorld(state) {
    const { cam, player } = state;
    const scale = view.scale * 0.92;
    const cx = cam.x;
    const cy = cam.y;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, canvas.width / 2 - cx * scale, canvas.height / 2 - cy * scale);
    drawGround(state);
    drawBuildings(state);
    drawObjectiveMarker(state);
    // Parked / traffic / police cars, then the player's car on top.
    for (const car of state.vehicles.cars) {
      if (car === player.car) continue;
      drawCar(car, false);
    }
    if (player.inCar && player.car) drawCar(player.car, true);
    for (const ped of state.peds.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.color, false, ped.state === 'down');
    }
    for (const cop of state.police.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1d2b53', false, false);
      context.fillStyle = '#ffffff';
      context.font = '700 8px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('LCPD', cop.x, cop.y - 16);
    }
    if (!player.inCar) {
      drawPerson(player.x, player.y, player.weapon === 'pistol' ? player.aimAngle : player.angle, '#ff6b81', true, false);
      // Aim line when armed.
      if (player.weapon === 'pistol') {
        context.strokeStyle = 'rgba(255,255,255,0.5)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(player.x + Math.cos(player.aimAngle) * 18, player.y + Math.sin(player.aimAngle) * 18);
        context.lineTo(player.x + Math.cos(player.aimAngle) * 120, player.y + Math.sin(player.aimAngle) * 120);
        context.stroke();
      }
    }
    drawEffects(state);
    // Day/night tint + headlight cones at night.
    const light = lightFor(state.time);
    context.fillStyle = light.tint;
    context.fillRect(cx - VIEW_W / 2 - 60, cy - VIEW_H / 2 - 60, VIEW_W + 120, VIEW_H + 120);
    if (light.day < 0.4) {
      const px = player.x;
      const py = player.y;
      context.save();
      context.globalCompositeOperation = 'lighter';
      const glow = context.createRadialGradient(px, py, 10, px, py, 260);
      glow.addColorStop(0, 'rgba(255,240,180,0.20)');
      glow.addColorStop(1, 'rgba(255,240,180,0)');
      context.fillStyle = glow;
      context.fillRect(px - 260, py - 260, 520, 520);
      context.restore();
    }
    // Remember the camera for mouse aiming and the HUD (in CSS pixels).
    state.cam.scale = scale / (window.devicePixelRatio || 1);
    state.cam.screenW = canvas.width / (window.devicePixelRatio || 1);
    state.cam.screenH = canvas.height / (window.devicePixelRatio || 1);
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawWorld, text, view, lightFor };
}
