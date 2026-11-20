// The HUD and the menus, drawn over the world on the same canvas: cash, health,
// wanted stars, the clock, the mission tracker, the minimap, subtitles, banners and
// the title / pause / wasted / busted panels. The minimap is a small live top-down
// view of the whole city with the player, the objective and the police on it.
import { COLORS, PLACES, ROADS_X, ROADS_Y, WORLD } from './config.js';
import { MISSION_DEFS } from './missions.js';
import { SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_WASTED } from './ui.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createHud(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();

  /** Map the 1280x720 HUD space onto the canvas, centred like the world view. */
  function begin() {
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    const x = (canvas.width - VIEW_W * scale) / 2;
    const y = (canvas.height - VIEW_H * scale) / 2;
    context.setTransform(scale, 0, 0, scale, x, y);
    return scale / ratio;
  }

  function end() {
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function star(x, y, filled, size) {
    context.save();
    context.translate(x, y);
    context.fillStyle = filled ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size / 2.2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.restore();
  }

  function clockText(timeSeconds) {
    const hour = Math.floor((timeSeconds / 3600) % 24);
    const minute = Math.floor((timeSeconds / 60) % 60);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function drawMinimap(state) {
    const size = 208;
    const x0 = VIEW_W - size - 16;
    const y0 = 16;
    const sx = size / WORLD.width;
    const sy = size / WORLD.height;
    context.save();
    context.beginPath();
    context.arc(x0 + size / 2, y0 + size / 2, size / 2 + 4, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = 'rgba(10,18,12,0.85)';
    context.fillRect(x0, y0, size, size);
    // Ocean and sand.
    context.fillStyle = '#1d7f9e';
    context.fillRect(x0 + 3380 * sx, y0, size - 3380 * sx, size);
    context.fillStyle = '#ecd9a0';
    context.fillRect(x0 + 3050 * sx, y0, 330 * sx, size);
    // Roads.
    context.strokeStyle = '#5a5b66';
    context.lineWidth = 3;
    for (const rx of ROADS_X) {
      context.beginPath();
      context.moveTo(x0 + rx * sx, y0);
      context.lineTo(x0 + rx * sx, y0 + size);
      context.stroke();
    }
    for (const ry of ROADS_Y) {
      context.beginPath();
      context.moveTo(x0, y0 + ry * sy);
      context.lineTo(x0 + size, y0 + ry * sy);
      context.stroke();
    }
    // Buildings as dots.
    context.fillStyle = 'rgba(255,255,255,0.35)';
    for (const b of state.city.buildings) {
      context.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    // Objective.
    const mission = state.missions.current();
    const obj = state.missions.objective();
    const taxi = state.missions.state.taxi;
    const target = taxi ? taxi.to : obj ? { x: obj.x, y: obj.y } : null;
    if (target) {
      context.fillStyle = '#ffd23e';
      context.beginPath();
      context.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Police as blue dots.
    context.fillStyle = '#4a90d9';
    for (const car of state.vehicles.cars) {
      if (car.kind !== 'police') continue;
      context.beginPath();
      context.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Player as a white arrow.
    const p = state.player;
    context.save();
    context.translate(x0 + p.x * sx, y0 + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    // Ring.
    context.strokeStyle = 'rgba(255,255,255,0.7)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x0 + size / 2, y0 + size / 2, size / 2 + 4, 0, Math.PI * 2);
    context.stroke();
    text('LEONIDA BAY', x0 + size / 2, y0 + size + 20, 12, 'rgba(255,255,255,0.8)', 'center', '700');
  }

  function drawHud(state, ui) {
    begin();
    const p = state.player;
    // Top-left: cash and health.
    context.textBaseline = 'top';
    text(`$${state.cash.toLocaleString('en-US')}`, 20, 18, 30, '#ffffff', 'left', '800');
    text(`Earned $${state.earned.toLocaleString('en-US')}`, 20, 54, 14, 'rgba(255,255,255,0.75)', 'left');
    // Health bar.
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(20, 78, 200, 14);
    context.fillStyle = p.health > 30 ? '#7ac74f' : '#ff5d5d';
    context.fillRect(22, 80, 196 * Math.max(0, p.health / 100), 10);
    text('HEALTH', 226, 78, 12, '#ffffff', 'left', '700');
    if (p.armor > 0) {
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(20, 98, 200, 10);
      context.fillStyle = '#4a90d9';
      context.fillRect(22, 99, 196 * Math.max(0, p.armor / 100), 8);
      text('ARMOR', 226, 97, 12, '#ffffff', 'left', '700');
    }
    // Weapon.
    text(p.inCar ? (p.car ? p.car.model : 'CAR') : p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS', 20, 118, 15, '#ffd23e', 'left', '700');
    // Top-right: wanted stars + clock, below the minimap.
    for (let i = 0; i < 5; i += 1) star(VIEW_W - 250 + i * 30, 278, i < state.wanted, 12);
    text(`WANTED ${state.wanted === 0 ? '—' : '★'.repeat(state.wanted)}`, VIEW_W - 250, 300, 13, state.wanted > 0 ? '#ff5d5d' : 'rgba(255,255,255,0.7)', 'left', '700');
    text(clockText(state.time), VIEW_W - 16, 324, 16, '#ffffff', 'right', '700');
    // Mission tracker, top centre.
    const mission = state.missions.current();
    const obj = state.missions.objective();
    if (mission && obj && !state.missions.state.failed) {
      const dist = Math.round(Math.hypot(p.x - obj.x, p.y - obj.y));
      context.fillStyle = 'rgba(0,0,0,0.55)';
      const label = `${mission.title} — ${obj.label}`;
      context.font = '700 16px system-ui, sans-serif';
      const w = context.measureText(label).width + 28;
      context.fillRect((VIEW_W - w) / 2, 14, w, 34);
      text(label, VIEW_W / 2, 22, 16, '#ffd23e', 'center', '700');
      text(`${dist}m`, VIEW_W / 2, 52, 14, '#ffffff', 'center');
      if (mission.timeLimit) {
        text(`⏱ ${Math.max(0, Math.ceil(state.missions.state.timer))}s`, VIEW_W / 2, 82, 16, '#ff5d5d', 'center', '800');
      }
    } else if (state.missions.state.failed) {
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect((VIEW_W - 420) / 2, 14, 420, 34);
      text('MISSION FAILED — press Enter to retry', VIEW_W / 2, 22, 16, '#ff5d5d', 'center', '700');
    } else if (!mission) {
      context.fillStyle = 'rgba(0,0,0,0.55)';
      const label = 'Story complete — King of the Bay. Free roam: taxi fares, packages, trouble.';
      context.font = '700 15px system-ui, sans-serif';
      const w = context.measureText(label).width + 28;
      context.fillRect((VIEW_W - w) / 2, 14, w, 34);
      text(label, VIEW_W / 2, 22, 15, '#7ac74f', 'center', '700');
    }
    // Taxi fare.
    const taxi = state.missions.state.taxi;
    if (taxi) {
      text(`TAXI FARE $${taxi.fare} — ${Math.ceil(taxi.timeLeft)}s left`, VIEW_W / 2, 100, 16, '#7ac74f', 'center', '800');
    }
    drawMinimap(state);
    // Subtitle (story dialogue).
    if (ui.subtitleTime > 0) {
      context.font = '600 19px system-ui, sans-serif';
      const w = Math.min(VIEW_W - 200, context.measureText(ui.subtitle).width + 32);
      context.fillStyle = 'rgba(0,0,0,0.65)';
      context.fillRect((VIEW_W - w) / 2, VIEW_H - 118, w, 40);
      text(ui.subtitle, VIEW_W / 2, VIEW_H - 108, 19, '#ffffff', 'center', '600');
    }
    // Banner (mission passed / failed).
    if (ui.bannerTime > 0) {
      text(ui.banner, VIEW_W / 2, VIEW_H / 2 - 120, 40, ui.bannerColor, 'center', '900');
    }
    // Context hint: enter a car / start a fare.
    if (!p.inCar) {
      const nearCar = state.vehicles.cars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 78);
      const nearTaxi = state.peds.peds.some((ped) => ped.state === 'taxi' && Math.hypot(ped.x - p.x, ped.y - p.y) < 46);
      if (nearCar) text('Press E to get in', VIEW_W / 2, VIEW_H - 170, 17, '#ffffff', 'center', '700');
      else if (nearTaxi && !taxi) text('Press E to take the fare', VIEW_W / 2, VIEW_H - 170, 17, '#7ac74f', 'center', '700');
    }
    // Control hints, fading after a minute.
    if (ui.help && ui.helpTime > 0) {
      context.globalAlpha = Math.min(1, ui.helpTime / 5);
      text('WASD move / drive   •   E enter car   •   Click shoot / punch   •   Shift run   •   P pause   •   M mute', VIEW_W / 2, VIEW_H - 24, 14, 'rgba(255,255,255,0.8)', 'center');
      context.globalAlpha = 1;
    }
    end();
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = 'rgba(8,10,18,0.82)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || '#ffd23e';
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW_W / 2, y + 66, 44, '#ffffff', 'center', '900');
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 116 + i * 32, 19, 'rgba(255,255,255,0.85)', 'center');
    });
    text(prompt, VIEW_W / 2, y + height - 30, 20, '#ffd23e', 'center', '700');
  }

  function drawScreen(state, ui, screen, stats) {
    begin();
    if (screen === SCREEN_TITLE) {
      drawPanel('LEONIDA BAY', [
        'An open-world crime story in the spirit of GTA 6.',
        'Six missions. A whole city to steal, drive and survive.',
        'On foot and by car — traffic, pedestrians, police, wanted stars.',
        '',
        `Missions done: ${state.missions.state.index} / ${MISSION_DEFS.length}    Packages: ${state.city.packages.filter((p) => p.taken).length} / 20`,
      ], 'Press Enter or click to start', '#ff2e88');
      text('A fan-made original. Not affiliated with Rockstar Games.', VIEW_W / 2, VIEW_H - 60, 13, 'rgba(255,255,255,0.6)', 'center');
      return;
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', [
        `Cash $${state.cash.toLocaleString('en-US')}    •    Missions ${state.missions.state.index}/${MISSION_DEFS.length}`,
        'The city waits for you.',
      ], 'Press P to resume', '#22d3ee');
      return;
    }
    if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', [
        'The paramedics scraped you off the asphalt.',
        `You lost half your cash. The story waits at ${stats.respawn}.`,
      ], 'Press Enter to get back out there', '#ff5d5d');
      return;
    }
    if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        'Leonida PD took you in. Bail cost you $100.',
        'The story waits at Downtown.',
      ], 'Press Enter to get back out there', '#4a90d9');
    }
    end();
  }

  return { drawHud, drawScreen, text };
}
