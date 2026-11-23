// Solmar Heat — rendering.
// Draws the city, the actors, the HUD and the minimap on one canvas, plus
// the title / pause / busted / wasted screens. Everything is flat vector
// shapes, so the game needs no image files at all.

import { TILE, COLS, ROWS, VIEW_W, VIEW_H, BEACH_START_ROW, COLORS } from './config.js';
import { isRoadTile, isBeachTile } from './city.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w; const h = car.h;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 7);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  roundRect(ctx, -w * 0.18, -h / 2 + 3, w * 0.34, h - 6, 4);
  ctx.fill();
  ctx.fillStyle = '#bfe8ff';
  roundRect(ctx, w * 0.16, -h / 2 + 4, w * 0.1, h - 8, 3);
  ctx.fill();
  // Headlights and taillights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-w / 2 - 1, -h / 2 + 2, 3, 5);
  ctx.fillRect(-w / 2 - 1, h / 2 - 7, 3, 5);
  if (car.kind === 'cop') {
    // White doors and a flashing light bar.
    ctx.fillStyle = COLORS.copWhite;
    ctx.fillRect(-w * 0.12, -h / 2, w * 0.24, h);
    ctx.fillStyle = (Math.floor(performance.now() / 260) % 2 === 0) ? '#ff2d55' : '#0a84ff';
    ctx.fillRect(-6, -h / 2 - 1, 12, 5);
  }
  if (car.kind === 'sport') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 1, 10, 3);
    ctx.fillRect(-w / 2 + 4, h / 2 - 4, 10, 3);
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down > 0) {
    // Lying flat after being hit.
    ctx.rotate(1.2);
    ctx.fillStyle = ped.color;
    ctx.fillRect(-11, -4, 22, 8);
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = ped.fleeing ? 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 7, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5d0a9';
  ctx.beginPath(); ctx.arc(0, -9 + bob, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, state, cam) {
  const city = state.city;
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const x1 = Math.min(COLS - 1, Math.ceil((cam.x + VIEW_W) / TILE) + 1);
  const y1 = Math.min(ROWS - 1, Math.ceil((cam.y + VIEW_H) / TILE) + 1);

  // Ground tiles: grass, sidewalk blocks, roads, sand and sea.
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const px = tx * TILE; const py = ty * TILE;
      if (ty === ROWS - 1) {
        ctx.fillStyle = COLORS.sea;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.seaDeep;
        ctx.fillRect(px, py + 26 + ((tx * 7) % 3) * 6, TILE, 3);
      } else if (isBeachTile(tx, ty)) {
        ctx.fillStyle = COLORS.sand;
        ctx.fillRect(px, py, TILE, TILE);
      } else if (isRoadTile(tx, ty)) {
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(px, py, TILE, TILE);
      } else {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.sidewalk : '#ac9d84';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }

  // Road centre dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isRoadTile(tx, ty)) continue;
      const px = tx * TILE; const py = ty * TILE;
      if (tx % 5 === 4 && ty % 5 !== 4) {
        if ((ty * TILE + py) % 64 < 32) ctx.fillRect(px + TILE / 2 - 2, py, 4, 26);
      }
      if (ty % 5 === 4 && tx % 5 !== 4) {
        if ((tx * TILE + px) % 64 < 32) ctx.fillRect(px, py + TILE / 2 - 2, 26, 4);
      }
    }
  }

  // Landmark buildings (spray shop, hideout, docks).
  for (const spot of [city.sprayShop, city.hideout, city.docks]) {
    const isSpray = spot === city.sprayShop;
    ctx.fillStyle = isSpray ? '#ff6b35' : spot === city.hideout ? '#7d5fff' : '#ffa502';
    ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
    ctx.strokeStyle = COLORS.buildingEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spot.label, spot.x + spot.w / 2, spot.y + spot.h / 2 + 5);
  }

  // Buildings: pastel roof, edge, windows.
  for (const b of city.buildings) {
    if (b.x + b.w < cam.x || b.x > cam.x + VIEW_W || b.y + b.h < cam.y || b.y > cam.y + VIEW_H) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = COLORS.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 16, 12);
      }
    }
  }

  // Palms.
  for (const palm of city.palms) {
    if (palm.x < cam.x - 30 || palm.x > cam.x + VIEW_W + 30 || palm.y < cam.y - 30 || palm.y > cam.y + VIEW_H + 30) continue;
    ctx.strokeStyle = COLORS.palmTrunk;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 3, palm.y - 14); ctx.stroke();
    ctx.fillStyle = COLORS.palmLeaf;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 10, palm.y - 16 + Math.sin(a) * 8, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mission marker: pulsing beacon.
  if (state.mission && state.mission.marker) {
    const m = state.mission.marker;
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, 5);
    ctx.restore();
    ctx.fillStyle = m.color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, m.x, m.y - 34);
  }

  // Cash bags.
  for (const bag of (state.mission && state.mission.bags) || []) {
    if (bag.taken) continue;
    ctx.save();
    ctx.translate(bag.x, bag.y + Math.sin(state.time * 3 + bag.x) * 3);
    ctx.fillStyle = COLORS.cash;
    roundRect(ctx, -11, -9, 22, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 5);
    ctx.restore();
  }
}

function drawMinimap(ctx, state) {
  const mw = 188; const mh = 132;
  const mx = VIEW_W - mw - 12; const my = 12;
  const sx = mw / (COLS * TILE); const sy = mh / (ROWS * TILE);
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,18,0.82)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
  // Roads.
  ctx.fillStyle = '#555';
  for (const rx of state.city.verticalRoads) ctx.fillRect(mx + rx * sx - 1, my, 2, mh);
  for (const ry of state.city.horizontalRoads) ctx.fillRect(mx, my + ry * sy, mw, 2);
  // Sea strip.
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx, my + mh - 8, mw, 8);
  // Marker.
  if (state.mission && state.mission.marker) {
    ctx.fillStyle = state.mission.marker.color;
    ctx.beginPath();
    ctx.arc(mx + state.mission.marker.x * sx, my + state.mission.marker.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#0a84ff';
  for (const c of state.cars) {
    if (c.driver !== 'police') continue;
    ctx.beginPath();
    ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawHud(ctx, state) {
  const p = state.player;
  // Cash and health, top-left.
  ctx.fillStyle = 'rgba(10,12,18,0.78)';
  roundRect(ctx, 12, 12, 208, 64, 8);
  ctx.fill();
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.cash}`, 24, 42);
  ctx.fillStyle = '#ff5b5b';
  roundRect(ctx, 24, 50, 150, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#37d67a';
  roundRect(ctx, 24, 50, Math.max(0, 150 * (p.health / 100)), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText('HEALTH', 178, 59);

  // Wanted stars, top-centre.
  const cx = VIEW_W / 2;
  ctx.fillStyle = 'rgba(10,12,18,0.78)';
  roundRect(ctx, cx - 90, 12, 180, 34, 8);
  ctx.fill();
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd60a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', cx - 64 + i * 32, 37);
  }

  // Speed, bottom-right (driving only).
  if (!p.onFoot && p.car) {
    ctx.fillStyle = 'rgba(10,12,18,0.78)';
    roundRect(ctx, VIEW_W - 132, VIEW_H - 64, 120, 52, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.18)}`, VIEW_W - 72, VIEW_H - 30);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('km/h', VIEW_W - 72, VIEW_H - 16);
  }

  // Mission banner, bottom-centre (kept narrow so the controls hint fits).
  if (state.mission && state.mission.def) {
    const text = state.mission.def.title + ' — ' + state.mission.hint;
    ctx.font = 'bold 14px sans-serif';
    const w = Math.min(520, ctx.measureText(text).width + 28);
    ctx.fillStyle = 'rgba(10,12,18,0.82)';
    roundRect(ctx, (VIEW_W - w) / 2, VIEW_H - 44, w, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW_W / 2, VIEW_H - 23);
  }

  // Toast message, mid-screen below the top HUD so it never covers a panel.
  if (state.message && state.time - state.messageAt < 4) {
    ctx.font = 'bold 16px sans-serif';
    const w = Math.min(640, ctx.measureText(state.message).width + 30);
    ctx.fillStyle = 'rgba(10,12,18,0.85)';
    roundRect(ctx, (VIEW_W - w) / 2, 150, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, VIEW_W / 2, 170);
  }

  // Controls hint, bottom-left (short, so it clears the mission banner).
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p.onFoot ? 'WASD move · SHIFT run · E steal' : 'W/S drive · A/D steer · E exit', 14, VIEW_H - 14);

  drawMinimap(ctx, state);
}

function drawScreen(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,10,16,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = accent;
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 250 + i * 30));
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.mode === 'title') {
    drawTitle(ctx, state);
    return;
  }
  const cam = state.camera;
  ctx.save();
  if (state.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, state, cam);
  for (const car of state.cars) drawCar(ctx, car);
  for (const ped of state.peds) drawPed(ctx, ped);
  // The player on foot.
  if (state.player.onFoot) {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 8, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath(); ctx.arc(0, -10, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -15, 12, 4);
    ctx.restore();
  }
  ctx.restore();

  drawHud(ctx, state);

  if (state.mode === 'paused') {
    drawScreen(ctx, 'PAUSED', ['Press P to keep playing', 'M toggles sound', 'R restarts the run'], '#ffd60a');
  } else if (state.mode === 'busted') {
    drawScreen(ctx, 'BUSTED!', [`The Solmar PD caught you with $${state.cash}.`, `Best cash: $${state.bestCash}`, 'Press R to run it back'], '#0a84ff');
  } else if (state.mode === 'wasted') {
    drawScreen(ctx, 'WASTED', [`You went down with $${state.cash} in your pocket.`, `Best cash: $${state.bestCash}`, 'Press R to run it back'], '#ff3b30');
  }
}

function drawTitle(ctx, state) {
  // Sunset gradient sky over a drawn skyline, then the title.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff7e5f');
  grad.addColorStop(0.55, '#feb47b');
  grad.addColorStop(1, '#2b1055');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(VIEW_W - 180, 130, 52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(30,16,48,0.9)';
  const skyline = [90, 150, 110, 190, 130, 170, 100, 160, 140, 120];
  let sx = 0;
  for (const h of skyline) {
    ctx.fillRect(sx, VIEW_H - 150 - h, 96, h + 150);
    sx += 96;
  }
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(0, VIEW_H - 60, VIEW_W, 60);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', VIEW_W / 2, 170);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('An open-world crime game in Solmar Bay', VIEW_W / 2, 205);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  const lines = [
    'Rio Vance just got out. The city is wide open: steal cars, outrun the law,',
    'run four jobs for cash — and do not get caught.',
    '',
    'WASD move / drive · E steal or exit a car · SHIFT run · P pause · M mute',
    `Best cash so far: $${state.bestCash}`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 300 + i * 28));
  const blink = Math.floor(state.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('— PRESS ENTER TO START —', VIEW_W / 2, 480);
  }
}
