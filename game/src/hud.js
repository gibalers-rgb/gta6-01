// The HUD and the menus, drawn over the world on the same canvas: cash, health,
// wanted stars, the clock, the district, the speedometer, the job tracker, the
// minimap, subtitles, banners and the title / pause / wasted / busted panels.
// The minimap is a small live top-down view of the whole city with the hero,
// the objective and the police on it.
import { CFG, SPOTS, hoodAt } from './tuning.js';
import { JOBS } from './story.js';
import { SCR_BUSTED, SCR_PAUSED, SCR_TITLE, SCR_WASTED } from './screens.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function makeHud(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();

  /** Map the 1280x720 HUD space onto the canvas, centred like the world view. */
  function begin() {
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    const x = (canvas.width - VIEW_W * scale) / 2;
    const y = (canvas.height - VIEW_H * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, x, y);
    return scale / ratio;
  }

  function end() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  /** A horizontal bar: dark backing, coloured fill, optional label. */
  function bar(x, y, w, h, frac, fill, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, frac)), h - 4);
    if (label) text(label, x + w + 6, y - 1, 12, '#ffffff', 'left', '700');
  }

  function star(x, y, lit, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = lit ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size / 2.2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function clockText(t) {
    const h = Math.floor((t / 3600) % 24);
    const m = Math.floor((t / 60) % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function drawMinimap(state) {
    const size = 200;
    const x0 = VIEW_W - size - 18;
    const y0 = 18;
    const sx = size / CFG.mapW;
    const sy = size / CFG.mapH;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x0 + size / 2, y0 + size / 2, size / 2 + 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,18,12,0.85)';
    ctx.fillRect(x0, y0, size, size);
    // Sea and sand.
    ctx.fillStyle = '#1e809f';
    ctx.fillRect(x0 + 3390 * sx, y0, size - 3390 * sx, size);
    ctx.fillStyle = '#eedca6';
    ctx.fillRect(x0 + 3060 * sx, y0, 330 * sx, size);
    // Streets.
    ctx.strokeStyle = '#5a5b66';
    ctx.lineWidth = 3;
    for (const sx of CFG.streetsX) {
      ctx.beginPath();
      ctx.moveTo(x0 + sx * sx, y0);
      ctx.lineTo(x0 + sx * sx, y0 + size);
      ctx.stroke();
    }
    for (const sy of CFG.streetsY) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + sy * sy);
      ctx.lineTo(x0 + size, y0 + sy * sy);
      ctx.stroke();
    }
    // Buildings as dots.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const b of state.city.buildings) {
      ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    // Objective.
    const job = state.jobs.current();
    const step = state.jobs.step();
    const fare = state.jobs.state.fare;
    const target = fare ? fare.to : step ? { x: step.x, y: step.y } : null;
    if (target) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police as blue dots.
    ctx.fillStyle = '#4a90d9';
    for (const car of state.cars.list) {
      if (car.kind !== 'police') continue;
      ctx.beginPath();
      ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hero as a white arrow.
    const p = state.hero;
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring, north tick, caption.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x0 + size / 2, y0 + size / 2, size / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x0 + size / 2, y0 - 2);
    ctx.lineTo(x0 + size / 2 - 5, y0 + 8);
    ctx.lineTo(x0 + size / 2 + 5, y0 + 8);
    ctx.closePath();
    ctx.fill();
    text('N', x0 + size / 2, y0 - 8, 11, '#ffffff', 'center', '800');
    text('MARISOL BAY', x0 + size / 2, y0 + size + 20, 12, 'rgba(255,255,255,0.8)', 'center', '700');
  }

  function drawHud(state, ui) {
    begin();
    const p = state.hero;
    ctx.textBaseline = 'top';
    // Top-left: cash, earned, health, armor.
    text(`$${state.cash.toLocaleString('en-US')}`, 20, 18, 30, '#ffffff', 'left', '800');
    text(`Earned $${state.earned.toLocaleString('en-US')}`, 20, 54, 14, 'rgba(255,255,255,0.75)', 'left');
    bar(20, 78, 200, 14, p.health / 100, p.health > 30 ? '#7ac74f' : '#ff5d5d', 'HEALTH');
    if (p.armor > 0) bar(20, 98, 200, 10, p.armor / 100, '#4a90d9', 'ARMOR');
    // Weapon (with ammo) or car, then the district.
    const ride = p.inCar
      ? (p.car ? p.car.model : 'CAR')
      : p.weapon === 'pistol' ? `PISTOL  ${p.ammo} ROUNDS` : 'FISTS';
    text(ride, 20, 118, 15, '#ffd23e', 'left', '700');
    text(hoodAt(p.x, p.y).toUpperCase(), 20, 142, 13, 'rgba(255,255,255,0.85)', 'left', '700');
    // Top-right: wanted stars + clock, below the minimap.
    for (let i = 0; i < 5; i += 1) star(VIEW_W - 250 + i * 30, 272, i < state.wanted, 12);
    text(`WANTED ${state.wanted === 0 ? '—' : '★'.repeat(state.wanted)}`, VIEW_W - 250, 294, 13,
      state.wanted > 0 ? '#ff5d5d' : 'rgba(255,255,255,0.7)', 'left', '700');
    text(clockText(state.time), VIEW_W - 16, 318, 16, '#ffffff', 'right', '700');
    // Speedometer, bottom-right, only while driving.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.speed) * 0.32);
      text(`${kmh}`, VIEW_W - 24, VIEW_H - 92, 44, '#ffffff', 'right', '800');
      text('KM/H', VIEW_W - 24, VIEW_H - 48, 13, 'rgba(255,255,255,0.75)', 'right', '700');
      bar(VIEW_W - 224, VIEW_H - 30, 200, 10, (p.car ? p.car.health : 0) / 100,
        p.car && p.car.health > 40 ? '#7ac74f' : '#ff5d5d');
    }
    // Job tracker, top centre.
    const job = state.jobs.current();
    const step = state.jobs.step();
    if (job && step && !state.jobs.state.failed) {
      const dist = Math.round(Math.hypot(p.x - step.x, p.y - step.y));
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const heading = `${job.name} — ${stepLabel(step, state.jobs.state.beaten, step.need || 1)}`;
      ctx.font = '700 16px system-ui, sans-serif';
      const w = ctx.measureText(heading).width + 28;
      ctx.fillRect((VIEW_W - w) / 2, 14, w, 34);
      text(heading, VIEW_W / 2, 22, 16, '#ffd23e', 'center', '700');
      text(`${dist}m`, VIEW_W / 2, 52, 14, '#ffffff', 'center');
      if (job.limit) {
        text(`⏱ ${Math.max(0, Math.ceil(state.jobs.state.timer))}s`, VIEW_W / 2, 82, 16, '#ff5d5d', 'center', '800');
      }
    } else if (state.jobs.state.failed) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect((VIEW_W - 420) / 2, 14, 420, 34);
      text('JOB FAILED — press Enter to retry', VIEW_W / 2, 22, 16, '#ff5d5d', 'center', '700');
    } else if (!job) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const heading = 'Story complete — Queen of the Bay. Free roam: taxi fares, packages, trouble.';
      ctx.font = '700 15px system-ui, sans-serif';
      const w = ctx.measureText(heading).width + 28;
      ctx.fillRect((VIEW_W - w) / 2, 14, w, 34);
      text(heading, VIEW_W / 2, 22, 15, '#7ac74f', 'center', '700');
    }
    // Taxi fare.
    const fare = state.jobs.state.fare;
    if (fare) {
      text(`TAXI FARE $${fare.fare} — ${Math.ceil(fare.timeLeft)}s left`, VIEW_W / 2, 100, 16, '#7ac74f', 'center', '800');
    }
    drawMinimap(state);
    // Subtitle (story dialogue).
    if (ui.lineT > 0) {
      ctx.font = '600 19px system-ui, sans-serif';
      const w = Math.min(VIEW_W - 200, ctx.measureText(ui.line).width + 32);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect((VIEW_W - w) / 2, VIEW_H - 118, w, 40);
      text(ui.line, VIEW_W / 2, VIEW_H - 108, 19, '#ffffff', 'center', '600');
    }
    // Banner (job done / failed).
    if (ui.flagT > 0) {
      text(ui.flag, VIEW_W / 2, VIEW_H / 2 - 120, 40, ui.flagColor, 'center', '900');
    }
    // Context hint: enter a car / start a fare / repair at the garage.
    if (!p.inCar) {
      const nearCar = state.cars.list.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 78);
      const nearFare = state.people.list.some((w) => w.mode === 'fare' && Math.hypot(w.x - p.x, w.y - p.y) < 46);
      if (nearCar) text('Press E to get in', VIEW_W / 2, VIEW_H - 170, 17, '#ffffff', 'center', '700');
      else if (nearFare && !fare) text('Press E to take the fare', VIEW_W / 2, VIEW_H - 170, 17, '#7ac74f', 'center', '700');
    } else if (p.car && p.car.health < 70) {
      const d = Math.hypot(p.x - SPOTS.garage.x, p.y - SPOTS.garage.y);
      if (d < 320) text("Eddie's Garage repairs your car — $50", VIEW_W / 2, VIEW_H - 170, 17, '#7ac74f', 'center', '700');
    }
    // Control hints, fading after a minute.
    if (ui.hints && ui.hintsT > 0) {
      ctx.globalAlpha = Math.min(1, ui.hintsT / 5);
      text('WASD move / drive   •   E enter car   •   Click shoot / punch   •   H horn   •   Shift sprint   •   Space handbrake   •   P pause   •   M mute',
        VIEW_W / 2, VIEW_H - 24, 14, 'rgba(255,255,255,0.8)', 'center');
      ctx.globalAlpha = 1;
    }
    end();
  }

  /** Human label for a job step, for the tracker. */
  function stepLabel(step, beaten, need) {
    const place = stepLabelPlace(step);
    switch (step.kind) {
      case 'enter': return 'Get in the cab by the safehouse';
      case 'goto': return `Go to ${place}`;
      case 'steal': return 'Steal the teal Solara GT at the marina lot';
      case 'deliver': return `Deliver it to ${place}`;
      case 'beat': return `Deal with them (${beaten}/${need})`;
      case 'collect': return `Grab it at ${place}`;
      case 'ram': return "Wreck Silas's car";
      default: return 'Keep going';
    }
  }

  function stepLabelPlace(step) {
    let best = null;
    let bestD = Infinity;
    for (const key of Object.keys(SPOTS)) {
      const s = SPOTS[key];
      const d = Math.hypot(s.x - step.x, s.y - step.y);
      if (d < bestD) {
        bestD = d;
        best = s.label;
      }
    }
    return best || 'the city';
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.fillStyle = 'rgba(8,10,18,0.82)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || '#ffd23e';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW_W / 2, y + 66, 44, '#ffffff', 'center', '900');
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 116 + i * 32, 19, 'rgba(255,255,255,0.85)', 'center');
    });
    text(prompt, VIEW_W / 2, y + height - 30, 20, '#ffd23e', 'center', '700');
  }

  function drawScreen(state, ui, screen, stats) {
    begin();
    if (screen === SCR_TITLE) {
      drawPanel('MARISOL BAY', [
        'An open-world crime story in the spirit of GTA 6.',
        'Seven jobs. A whole city to steal, drive and survive.',
        'On foot and by car — traffic, walkers, police, wanted stars.',
        '',
        `Jobs done: ${state.jobs.state.index} / ${JOBS.length}    Packages: ${state.city.packages.filter((p) => p.taken).length} / 20`,
      ], 'Press Enter or click to start', '#ff2e88');
      text('A fan-made original. Not affiliated with Rockstar Games.', VIEW_W / 2, VIEW_H - 60, 13, 'rgba(255,255,255,0.6)', 'center');
      return;
    }
    if (screen === SCR_PAUSED) {
      drawPanel('Paused', [
        `Cash $${state.cash.toLocaleString('en-US')}    •    Jobs ${state.jobs.state.index}/${JOBS.length}`,
        'The city waits for you.',
      ], 'Press P to resume', '#22d3ee');
      return;
    }
    if (screen === SCR_WASTED) {
      drawPanel('WASTED', [
        'The paramedics scraped you off the asphalt.',
        `You lost half your cash. The story waits at ${stats.respawn}.`,
      ], 'Press Enter to get back out there', '#ff5d5d');
      return;
    }
    if (screen === SCR_BUSTED) {
      drawPanel('BUSTED', [
        'Marisol PD took you in. Bail cost you $100.',
        'The story waits at Downtown.',
      ], 'Press Enter to get back out there', '#4a90d9');
    }
    end();
  }

  return { drawHud, drawScreen, text };
}
