// Everything drawn in screen space: the HUD, the minimap, the dialogue,
// the title and pause menus, and the busted / wasted screens.

import { MISSIONS, missionTarget } from './missions.js';
import { WEAPONS } from './combat.js';
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, WATER_Y, BEACH_Y, districtAt } from './city.js';
import { clamp } from './rng.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawHUD(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  const p = G.player;

  // Mission objective, top-left.
  if (G.mission) {
    const m = G.mission;
    const step = m.def.steps[m.step];
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    roundRect(ctx, 16, 14, 360, 74, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 15px Verdana';
    ctx.textAlign = 'left';
    ctx.fillText(`★ ${m.def.title}`, 30, 38);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px Verdana';
    const target = missionTarget(G);
    let label = step ? step.label : '';
    if (target && (step.kind === 'goto' || step.kind === 'grab' || step.kind === 'collect')) {
      const d = Math.round(Math.hypot(p.x - target.x, p.y - target.y));
      label += `  —  ${d}m`;
    }
    ctx.fillText(label, 30, 60);
    if (m.def.timer) {
      ctx.fillStyle = m.timer < 30 ? '#ff5a5a' : '#ffd23a';
      ctx.font = 'bold 15px Verdana';
      ctx.fillText(`⏱ ${Math.ceil(m.timer)}s`, 30, 80);
    }
  } else if (G.progress.missionIndex < MISSIONS.length) {
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    roundRect(ctx, 16, 14, 360, 52, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 14px Verdana';
    ctx.textAlign = 'left';
    ctx.fillText(`Next job: ${MISSIONS[G.progress.missionIndex].title}`, 30, 36);
    ctx.fillStyle = '#cfd8e3';
    ctx.font = '12px Verdana';
    ctx.fillText('Press ENTER to take the call from Mira.', 30, 56);
  }

  // Cash, wanted, health, armor — top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  roundRect(ctx, W - 296, 14, 280, 92, 8);
  ctx.fill();
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 24px Verdana';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, W - 30, 46);
  ctx.font = 'bold 22px Verdana';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffcf3a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 30 - i * 26, 76);
  }
  // Health + armor bars.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(W - 266, 88, 110, 8);
  ctx.fillStyle = p.hp > 30 ? '#37d67a' : '#ff5a5a';
  ctx.fillRect(W - 266, 88, 110 * clamp(p.hp / 100, 0, 1), 8);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(W - 146, 88, 110, 8);
  ctx.fillStyle = '#5aa8e0';
  ctx.fillRect(W - 146, 88, 110 * clamp(p.armor / 100, 0, 1), 8);

  // Weapon and ammo, bottom-right.
  const w = WEAPONS[p.weapon];
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  roundRect(ctx, W - 216, H - 118, 200, 52, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Verdana';
  ctx.textAlign = 'right';
  ctx.fillText(w.name, W - 30, H - 94);
  ctx.fillStyle = '#ffd23a';
  ctx.font = '13px Verdana';
  ctx.fillText(w.mag ? `${p.ammoInMag} / ${p.ammoReserve}` : '∞', W - 30, H - 74);

  // Speed, clock, district — bottom-right above the weapon box.
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  roundRect(ctx, W - 216, H - 176, 200, 50, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Verdana';
  ctx.fillText(p.car ? `${Math.round(Math.abs(p.car.speed) * 0.32)} km/h` : districtAt(G.city, p.x, p.y), W - 30, H - 150);
  ctx.fillStyle = '#cfd8e3';
  ctx.font = '12px Verdana';
  ctx.fillText(`${formatClock(G.clockHour)}  •  ${districtAt(G.city, p.x, p.y)}`, W - 30, H - 132);

  // Radio + hints, bottom-center.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,12,18,0.6)';
  roundRect(ctx, W / 2 - 250, H - 34, 500, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#cfd8e3';
  ctx.font = '12px Verdana';
  ctx.fillText(
    p.car
      ? 'W/S drive  •  A/D steer  •  Space handbrake  •  E leave car  •  F radio'
      : 'WASD move  •  Shift run  •  E steal car  •  Click shoot  •  R reload  •  1/2/3 weapons',
    W / 2, H - 17,
  );

  drawMinimap(ctx, G);
  drawFeed(ctx, G);
  drawDialogue(ctx, G);
  drawBanner(ctx, G);

  if (G.fare) {
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    roundRect(ctx, W / 2 - 150, 14, 300, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 14px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(`TAXI FARE — ${Math.ceil(G.fare.timer)}s left`, W / 2, 37);
  }

  // Hurt vignette.
  if (G.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,30,30,${Math.min(0.35, G.hurtFlash)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Night tint.
  const hour = G.clockHour;
  if (hour < 6 || hour >= 19.5) {
    ctx.fillStyle = 'rgba(10,16,48,0.20)';
    ctx.fillRect(0, 0, W, H);
  } else if (hour >= 17.5 && hour < 19.5) {
    ctx.fillStyle = 'rgba(255,120,40,0.08)';
    ctx.fillRect(0, 0, W, H);
  }
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function drawMinimap(ctx, G) {
  const mw = 240;
  const mh = 176;
  const x0 = 16;
  const y0 = G.viewH - mh - 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,18,0.78)';
  roundRect(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#4a6a3a';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0, y0 + BEACH_Y * sy, mw, (WORLD_H - BEACH_Y) * sy);
  ctx.fillStyle = '#3a3f45';
  for (const rx of ROADS_X) ctx.fillRect(x0 + rx * sx - 2, y0, 4, mh);
  for (const ry of ROADS_Y) ctx.fillRect(x0, y0 + ry * sy - 2, mw, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const b of G.city.buildings) {
    ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  const blip = (x, y, color, r = 4) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  const target = missionTarget(G);
  if (target) blip(target.x, target.y, '#ffd23a', 6);
  if (G.fare) blip(G.fare.dest.x, G.fare.dest.y, '#37d67a', 5);
  if (G.fareWaiting) blip(G.fareWaiting.x, G.fareWaiting.y, '#37d67a', 4);
  for (const pk of G.pickups) if (!pk.taken && pk.kind === 'cash') blip(pk.x, pk.y, '#7ad98a', 2.5);
  const blink = Math.floor(G.time * 3) % 2 === 0;
  for (const car of G.cars) if (car.kind === 'cop') blip(car.x, car.y, blink ? '#ff3a3a' : '#3a7aff', 4);
  for (const cop of G.cops) blip(cop.x, cop.y, '#ff8a8a', 3);
  // Player arrow.
  const px = x0 + G.player.x * sx;
  const py = y0 + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.car ? G.player.car.angle : G.player.aimAngle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // Viewport frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x0 + (G.cam.x - G.viewW / 2 / G.cam.zoom) * sx,
    y0 + (G.cam.y - G.viewH / 2 / G.cam.zoom) * sy,
    (G.viewW / G.cam.zoom) * sx,
    (G.viewH / G.cam.zoom) * sy,
  );
  ctx.restore();
  ctx.fillStyle = '#cfd8e3';
  ctx.font = '11px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText('SOLARA BAY', x0 + 2, y0 + mh + 14);
}

function drawFeed(ctx, G) {
  ctx.textAlign = 'left';
  ctx.font = '13px Verdana';
  let y = G.viewH - 210;
  for (let i = G.feedItems.length - 1; i >= 0; i--) {
    const item = G.feedItems[i];
    ctx.globalAlpha = Math.min(1, item.life);
    ctx.fillStyle = item.color || '#ffffff';
    ctx.fillText(item.text, 272, y);
    y -= 20;
  }
  ctx.globalAlpha = 1;
}

function drawDialogue(ctx, G) {
  if (!G.dialogue.length) return;
  const W = G.viewW;
  const H = G.viewH;
  const line = G.dialogue[0];
  ctx.fillStyle = 'rgba(8,12,18,0.82)';
  roundRect(ctx, W / 2 - 330, H - 190, 660, 64, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 13px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText('PHONE — MIRA SOLANO', W / 2 - 310, H - 164);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Verdana';
  wrapText(ctx, line, W / 2 - 310, H - 142, 620, 18);
  ctx.fillStyle = '#8a94a3';
  ctx.font = '11px Verdana';
  ctx.textAlign = 'right';
  ctx.fillText('ENTER ▸', W / 2 + 310, H - 134);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function drawBanner(ctx, G) {
  if (!G.banner) return;
  const W = G.viewW;
  ctx.globalAlpha = Math.min(1, G.banner.timer);
  ctx.fillStyle = G.banner.color;
  ctx.font = 'bold 44px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText(G.banner.title, W / 2, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Verdana';
  ctx.fillText(G.banner.sub, W / 2, 236);
  ctx.globalAlpha = 1;
}

export function drawTitle(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  // Sun-soaked gradient sky and a skyline silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.45, '#ff5a7a');
  grad.addColorStop(0.75, '#3a2a5a');
  grad.addColorStop(1, '#141a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(W * 0.78, 150, 54, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a2030';
  let bx = 0;
  const skyline = [150, 220, 180, 260, 200, 300, 170, 240, 280, 190, 230];
  for (const h of skyline) {
    ctx.fillRect(bx, H - 260 - h + 120, 118, h + 140);
    bx += 118;
  }
  ctx.fillStyle = 'rgba(255,120,60,0.25)';
  ctx.fillRect(0, H - 140, W, 140);
  // Title block.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px Verdana';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLARA HEAT', W / 2, 190);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 22px Verdana';
  ctx.fillText('AN OPEN-WORLD CRIME STORY IN SOLARA BAY', W / 2, 232);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px Verdana';
  ctx.fillText('Leo Vane owes the wrong man two grand. Steal cars, outrun the Solara PD,', W / 2, 290);
  ctx.fillText('run five jobs for Mira Solano — and take the city back, one score at a time.', W / 2, 314);

  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  roundRect(ctx, W / 2 - 330, 350, 660, 190, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 18px Verdana';
  ctx.fillText(G.hasSave ? '▶  ENTER — CONTINUE' : '▶  ENTER — NEW GAME', W / 2, 392);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Verdana';
  ctx.fillText('WASD move  •  Shift sprint  •  E steal / enter car  •  Mouse aim, Click shoot', W / 2, 428);
  ctx.fillText('W/S drive  •  A/D steer  •  Space handbrake  •  R reload  •  1/2/3 weapons', W / 2, 452);
  ctx.fillText('ENTER take a job  •  ESC pause & save  •  M mute music  •  H hide this help', W / 2, 476);
  ctx.fillStyle = '#8a94a3';
  ctx.font = '12px Verdana';
  ctx.fillText('5 story missions  •  taxi fares  •  12 hidden cash stashes  •  wanted levels 1–5  •  day & night', W / 2, 510);
  ctx.fillStyle = '#5a6474';
  ctx.font = '11px Verdana';
  ctx.fillText('An original game. No Rockstar Games names, characters, art or music. Built from scratch for make.fun.', W / 2, H - 24);
}

export function drawPause(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Verdana';
  ctx.fillText('PAUSED', W / 2, H / 2 - 110);
  ctx.fillStyle = '#cfd8e3';
  ctx.font = '15px Verdana';
  ctx.fillText(`Cash $${G.player.cash.toLocaleString('en-US')}   •   Missions done ${G.stats.missions}/5   •   Fares ${G.stats.fares}   •   Stashes ${G.stats.stashes}/12`, W / 2, H / 2 - 66);
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 17px Verdana';
  ctx.fillText('ESC resume    •    S save game    •    M music: ' + (G.audio.musicOn ? 'ON' : 'OFF') + '    •    Q quit to title', W / 2, H / 2 - 20);
  ctx.fillStyle = '#8a94a3';
  ctx.font = '13px Verdana';
  ctx.fillText('Progress saves automatically after every mission.', W / 2, H / 2 + 16);
}

export function drawEndCard(ctx, G, title, sub, color) {
  const W = G.viewW;
  const H = G.viewH;
  ctx.fillStyle = 'rgba(5,8,14,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 64px Verdana';
  ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px Verdana';
  ctx.fillText(sub, W / 2, H / 2 + 4);
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 16px Verdana';
  ctx.fillText('Press ENTER to get back on the street', W / 2, H / 2 + 52);
}
