// Drawing only: the world's state and the current screen in, pixels out. The camera
// follows the player across the 2400x1800 city; the HUD, minimap and panels are drawn
// in screen space. No rule lives here, only pixels.
import {
  BEACH_Y, CAR, FONT, MISSIONS, PALETTE, ROADS_H, ROADS_V, ROAD_W, WATER_Y, WORLD,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hash(x, y) { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return h - Math.floor(h); }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 1280, vh = 720;
  const fonts = new Map();
  function font(size, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }
  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * ratio);
    canvas.height = Math.round(vh * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawGround(cam) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, vw, vh);
    // Mow stripes for the grass, cheap and stable.
    ctx.fillStyle = PALETTE.grass2;
    for (let y = Math.floor(cam.y / 120) * 120; y < cam.y + vh + 120; y += 240) {
      ctx.fillRect(0, y - cam.y, vw, 120);
    }
    // Park block.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(355 - cam.x, 355 - cam.y, 490, 390);
    // Sand + water along the south edge.
    if (BEACH_Y - cam.y < vh) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(0, BEACH_Y - cam.y, vw, WATER_Y - BEACH_Y);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(0, WATER_Y - cam.y, vw, vh - (WATER_Y - cam.y));
      ctx.fillStyle = PALETTE.water2;
      for (let x = Math.floor(cam.x / 90) * 90; x < cam.x + vw + 90; x += 90) {
        const yy = WATER_Y + 26 + hash(x, 7) * 30;
        ctx.fillRect(x - cam.x, yy - cam.y, 46, 3);
      }
    }
    // Roads + sidewalks.
    for (const rx of ROADS_V) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(rx - ROAD_W / 2 - 14 - cam.x, -cam.y, ROAD_W + 28, vh + 0);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, vh + 0);
    }
    for (const ry of ROADS_H) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(-cam.x, ry - ROAD_W / 2 - 14 - cam.y, vw, ROAD_W + 28);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, vw, ROAD_W);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROADS_V) {
      for (let y = Math.floor(cam.y / 64) * 64; y < cam.y + vh + 64; y += 64) {
        if (ROADS_H.some((ry) => Math.abs(y - ry) < ROAD_W / 2 + 8)) continue;
        ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 30);
      }
    }
    for (const ry of ROADS_H) {
      for (let x = Math.floor(cam.x / 64) * 64; x < cam.x + vw + 64; x += 64) {
        if (ROADS_V.some((rx) => Math.abs(x - rx) < ROAD_W / 2 + 8)) continue;
        ctx.fillRect(x - cam.x, ry - 2 - cam.y, 30, 4);
      }
    }
    // Dock pier on the west edge.
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(0 - cam.x, 768 - cam.y, 130, 64);
    ctx.fillStyle = '#6e5436';
    for (let x = 8; x < 130; x += 18) ctx.fillRect(x - cam.x, 768 - cam.y, 3, 64);
    ctx.fillStyle = '#a9803e';
    ctx.fillRect(88 - cam.x, 776 - cam.y, 26, 22);
    ctx.fillRect(96 - cam.x, 806 - cam.y, 20, 18);
  }

  function drawBuildings(state, cam) {
    for (const b of state.buildings) {
      if (b.x + b.w < cam.x - 40 || b.x > cam.x + vw + 40 || b.y + b.h < cam.y - 40 || b.y > cam.y + vh + 40) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + b.hgt * 0.5 - cam.x, b.y + b.hgt * 0.5 - cam.y, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 6 - cam.x, b.y + 6 - cam.y, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (hash(b.x + i * 31, b.y + j * 47) < 0.45) {
            ctx.fillRect(b.x + 10 + i * 34 - cam.x, b.y + 10 + j * 34 - cam.y, 16, 12);
          }
        }
      }
    }
  }

  function drawTrees(state, cam) {
    for (const t of state.trees) {
      if (t.x < cam.x - 30 || t.x > cam.x + vw + 30 || t.y < cam.y - 30 || t.y > cam.y + vh + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(t.x + 5 - cam.x, t.y + 6 - cam.y, 13 * t.s, 9 * t.s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a3d24';
      ctx.fillRect(t.x - 2 - cam.x, t.y - 2 - cam.y, 4, 8);
      ctx.fillStyle = hash(t.x, t.y) < 0.5 ? PALETTE.tree : PALETTE.tree2;
      ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, 12 * t.s, 0, TAU); ctx.fill();
    }
  }

  function drawCarShape(c, cam, time) {
    const x = c.x - cam.x, y = c.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(3, 4, CAR.length / 2 + 2, CAR.width / 2 + 2, 0, 0, TAU); ctx.fill();
    // Wheels.
    ctx.fillStyle = '#14141a';
    ctx.fillRect(-26, -CAR.width / 2 - 3, 16, 6); ctx.fillRect(10, -CAR.width / 2 - 3, 16, 6);
    ctx.fillRect(-26, CAR.width / 2 - 3, 16, 6); ctx.fillRect(10, CAR.width / 2 - 3, 16, 6);
    // Body.
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 10);
    ctx.fill();
    if (c.police) {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-8, -CAR.width / 2, 16, CAR.width);
      ctx.fillStyle = '#111';
      text('PD', 0, 5, 13, '#111', 'center', true);
      const flash = Math.floor(time * 3) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-14, -CAR.width / 2 - 2, 12, 7);
      ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(2, -CAR.width / 2 - 2, 12, 7);
    } else {
      ctx.fillStyle = 'rgba(20,20,30,0.55)';
      ctx.fillRect(-6, -CAR.width / 2 + 6, 22, CAR.width - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(CAR.length / 2 - 12, -CAR.width / 2 + 5, 5, CAR.width - 10);
    }
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 4, 3, 6);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 10, 3, 6);
    ctx.restore();
    if (c.smoke > 0 || c.hp < 55) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(x - Math.cos(c.angle) * 34, y - Math.sin(c.angle) * 34, 7 + hash(c.x, Math.floor(time * 6)) * 6, 0, TAU);
      ctx.fill();
    }
    if (c.disabled) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
    }
  }

  function drawPed(p, cam, time) {
    const x = p.x - cam.x, y = p.y - cam.y;
    ctx.save(); ctx.translate(x, y);
    if (p.state === 'down') {
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(13, 0, 6, 0, TAU); ctx.fill();
    } else {
      const bob = Math.sin(time * 10 + p.x) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(2, 3, 10, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = p.shirt;
      ctx.beginPath(); ctx.arc(0, bob * 0.3, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 + bob * 0.3, 5.5, 0, TAU); ctx.fill();
      if (p.state === 'flee') {
        text('!', 0, -16, 16, '#ff4d4d', 'center', true);
      }
    }
    ctx.restore();
  }

  function drawPlayer(state, cam, time) {
    const p = state.player;
    if (!p.onFoot) return;
    const x = p.x - cam.x, y = p.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 13, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath(); ctx.arc(x + Math.cos(p.angle) * 5, y + Math.sin(p.angle) * 5, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(p.angle) * 20, y + Math.sin(p.angle) * 20); ctx.stroke();
    if (p.punchAnim > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 34, p.angle - 0.9, p.angle + 0.9);
      ctx.stroke();
    }
  }

  function drawLandmarks(state, cam, time) {
    // Hideout house (NW plaza).
    const hx = 150 - cam.x, hy = 150 - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(hx - 26, hy - 18, 56, 44);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(hx - 30, hy - 22, 60, 44);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(hx - 36, hy - 20); ctx.lineTo(hx, hy - 44); ctx.lineTo(hx + 36, hy - 20); ctx.closePath(); ctx.fill();
    text('HIDEOUT', hx, hy + 38, 11, PALETTE.text, 'center', true);
    // Lighthouse (SE, on the sand).
    const lx = 2270 - cam.x, ly = 1560 - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(lx + 4, ly + 20, 20, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2ede0'; ctx.fillRect(lx - 12, ly - 46, 24, 64);
    ctx.fillStyle = '#d95f5f'; ctx.fillRect(lx - 12, ly - 34, 24, 12); ctx.fillRect(lx - 12, ly - 10, 24, 12);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(lx, ly - 52, 8, 0, TAU); ctx.fill();
    const beamA = time * 0.7;
    ctx.save();
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.moveTo(lx, ly - 52);
    ctx.lineTo(lx + Math.cos(beamA) * 260, ly - 52 + Math.sin(beamA) * 260);
    ctx.lineTo(lx + Math.cos(beamA + 0.25) * 260, ly - 52 + Math.sin(beamA + 0.25) * 260);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    text('LIGHTHOUSE', lx, ly + 36, 11, PALETTE.text, 'center', true);
    text('DOCKS', 66 - cam.x, 756 - cam.y, 11, PALETTE.text, 'center', true);
  }

  function drawMarker(state, cam, time) {
    if (state.mission >= 3) return;
    const t = MISSIONS[state.mission].target;
    const x = t.x - cam.x, y = t.y - cam.y;
    const pulse = 1 + Math.sin(time * 5) * 0.12;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(x - 3, y - 90, 6, 90);
    ctx.restore();
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 26 * pulse, 0, TAU); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x - 8, y - 30); ctx.lineTo(x + 8, y - 30); ctx.closePath(); ctx.fill();
  }

  function drawPickups(state, cam, time) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const x = pk.x - cam.x, y = pk.y - cam.y + Math.sin(time * 3 + pk.x) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(pk.x - cam.x, pk.y - cam.y + 10, 12, 5, 0, 0, TAU); ctx.fill();
      if (pk.kind === 'gun') {
        ctx.fillStyle = '#22242e'; ctx.fillRect(x - 10, y - 4, 20, 7); ctx.fillRect(x - 2, y + 3, 5, 9);
        ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 17, 0, TAU); ctx.stroke();
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#3d6b35'; ctx.fillRect(x - 11, y - 8, 22, 16);
        ctx.fillStyle = PALETTE.gold; ctx.fillRect(x - 11, y - 2, 22, 3);
        text('AMMO', x, y + 26, 10, PALETTE.text, 'center', true);
      } else {
        ctx.fillStyle = '#2f9e5f';
        ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
        text('$', x, y + 5, 16, '#fff', 'center', true);
      }
    }
  }

  function drawHud(state, screen, extra) {
    const p = state.player;
    // Top-left: health + cash.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(14, 12, 240, 58);
    ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 1;
    ctx.strokeRect(14, 12, 240, 58);
    text(`$${p.money}`, 26, 38, 24, PALETTE.gold, 'left', true);
    ctx.fillStyle = '#222';
    ctx.fillRect(26, 48, 180, 10);
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.danger;
    ctx.fillRect(26, 48, 180 * clamp(p.health / 100, 0, 1), 10);
    if (p.hasGun) text(`Pistol  ${p.ammo}`, 214, 38, 15, PALETTE.text, 'left', true);
    // Top-right: wanted stars.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(vw - 204, 12, 190, 44);
    for (let i = 0; i < 5; i++) {
      text('★', vw - 188 + i * 36, 44, 26, i < p.wanted ? '#ffb400' : 'rgba(255,255,255,0.22)', 'left', true);
    }
    // Top-centre: mission objective.
    if (state.mission < 3) {
      const m = MISSIONS[state.mission];
      const label = state.mission === 2
        ? `${m.name} — ${m.text}  •  ${Math.max(0, Math.ceil(state.missionTimer))}s`
        : `${m.name} — ${m.text}`;
      const w = ctx.measureText(label) + 0;
      ctx.font = font(16, true);
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect((vw - tw) / 2 - 14, 12, tw + 28, 34);
      text(label, vw / 2, 35, 16, PALETTE.gold, 'center', true);
    } else {
      ctx.font = font(16, true);
      const label = 'All missions complete — free roam';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect((vw - tw) / 2 - 14, 12, tw + 28, 34);
      text(label, vw / 2, 35, 16, PALETTE.health, 'center', true);
    }
    // Bottom hints.
    const hints = p.onFoot
      ? 'WASD move · Shift run · E enter car · Space punch · F / click shoot · P pause · M mute'
      : 'W/S drive · A/D steer · E get out · F shoot · P pause · M mute';
    ctx.font = font(13);
    const hw = ctx.measureText(hints).width;
    ctx.fillStyle = 'rgba(12,10,24,0.6)';
    ctx.fillRect((vw - hw) / 2 - 10, vh - 32, hw + 20, 24);
    text(hints, vw / 2, vh - 15, 13, PALETTE.muted, 'center');
    if (extra && extra.muted) text('MUTED', vw - 16, vh - 44, 13, PALETTE.muted, 'right', true);
    if (p.onFoot && p.arrestTimer > 0) {
      text('THE POLICE ARE GRABBING YOU!', vw / 2, vh - 52, 18, PALETTE.danger, 'center', true);
    }
    // Banner.
    if (state.bannerT > 0 && state.banner) {
      ctx.font = font(26, true);
      const bw = ctx.measureText(state.banner).width;
      ctx.fillStyle = 'rgba(12,10,24,0.75)';
      ctx.fillRect((vw - bw) / 2 - 18, 84, bw + 36, 44);
      text(state.banner, vw / 2, 115, 26, PALETTE.gold, 'center', true);
    }
    drawMinimap(state);
    // Off-screen mission arrow.
    if (state.mission < 3 && screen === SCREEN_PLAY) {
      const t = MISSIONS[state.mission].target;
      const pxx = p.x, pyy = p.y;
      const dx = t.x - pxx, dy = t.y - pyy;
      if (Math.hypot(dx, dy) > 560) {
        const a = Math.atan2(dy, dx);
        const ax = vw / 2 + Math.cos(a) * (Math.min(vw, vh) / 2 - 70);
        const ay = vh / 2 + Math.sin(a) * (Math.min(vw, vh) / 2 - 70);
        ctx.save();
        ctx.translate(ax, ay); ctx.rotate(a);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
        ctx.restore();
        text(`${Math.round(Math.hypot(dx, dy))}m`, ax, ay + 34, 12, PALETTE.gold, 'center', true);
      }
    }
  }

  function drawMinimap(state) {
    const mw = 180, mh = 135, mx = vw - mw - 14, my = vh - mh - 14;
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(10, 12, 22, 0.85)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 1;
    ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(mx, my + WATER_Y * sy, mw, mh - WATER_Y * sy);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) ctx.fillRect(mx + (rx - ROAD_W / 2) * sx, my, ROAD_W * sx, mh);
    for (const ry of ROADS_H) ctx.fillRect(mx, my + (ry - ROAD_W / 2) * sy, mw, ROAD_W * sy);
    if (state.mission < 3) {
      const t = MISSIONS[state.mission].target;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, 4, 0, TAU); ctx.fill();
    }
    for (const c of state.cars) {
      ctx.fillStyle = c.police ? '#ff4d4d' : '#cfd6dd';
      ctx.fillRect(mx + c.x * sx - 1.5, my + c.y * sy - 1.5, 3, 3);
    }
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.cyan;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const lineH = 30;
    const h = 150 + lines.length * lineH + 70;
    const x = (vw - w) / 2, y = (vh - h) / 2;
    ctx.fillStyle = 'rgba(8, 6, 18, 0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || PALETTE.panelEdge; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(title, vw / 2, y + 74, 46, accent || PALETTE.neon, 'center', true);
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], vw / 2, y + 128 + i * lineH, 19, i === 0 ? PALETTE.text : PALETTE.muted, 'center');
    }
    if (prompt) text(prompt, vw / 2, y + h - 30, 20, PALETTE.gold, 'center', true);
  }

  function draw(state, screen, extra) {
    const time = state.time;
    const p = state.player;
    let camX = clamp(p.x - vw / 2, 0, WORLD.width - vw);
    let camY = clamp(p.y - vh / 2, 0, WORLD.height - vh);
    if (camX < 0) camX = (WORLD.width - vw) / 2;
    if (camY < 0) camY = (WORLD.height - vh) / 2;
    if (state.shake > 0) {
      camX += (hash(time * 91, 3) - 0.5) * state.shake;
      camY += (hash(time * 57, 9) - 0.5) * state.shake;
    }
    const cam = { x: camX, y: camY };
    ctx.clearRect(0, 0, vw, vh);
    drawGround(cam);
    drawBuildings(state, cam);
    drawTrees(state, cam);
    drawLandmarks(state, cam, time);
    drawMarker(state, cam, time);
    drawPickups(state, cam, time);
    for (const s of state.skids) {
      ctx.strokeStyle = `rgba(20,20,26,${clamp(s.life, 0, 0.5)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.a) * 14 - cam.x, s.y - Math.sin(s.a) * 14 - cam.y);
      ctx.lineTo(s.x + Math.cos(s.a) * 14 - cam.x, s.y + Math.sin(s.a) * 14 - cam.y);
      ctx.stroke();
    }
    for (const c of state.cars) {
      if (c.x < cam.x - 80 || c.x > cam.x + vw + 80 || c.y < cam.y - 80 || c.y > cam.y + vh + 80) continue;
      drawCarShape(c, cam, time);
    }
    for (const pd of state.peds) {
      if (pd.x < cam.x - 40 || pd.x > cam.x + vw + 40 || pd.y < cam.y - 40 || pd.y > cam.y + vh + 40) continue;
      drawPed(pd, cam, time);
    }
    drawPlayer(state, cam, time);
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(b.x - cam.x, b.y - cam.y, 3.5, 0, TAU); ctx.fill();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (screen === SCREEN_TITLE) {
      const lines = [
        'Steal cars. Outrun the police. Run three story missions across Neon Harbor.',
        'WASD move · Shift run · E enter / steal car · Space punch · F / click shoot',
        'W/S drive · A/D steer · M mute · P pause — your progress autosaves.',
      ];
      if (extra && extra.hasSave) lines.push('A saved game is waiting — press C to continue it.');
      drawPanel('NEON HARBOR', lines, 'Press ENTER to start', PALETTE.neon);
      return;
    }
    drawHud(state, screen, extra);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.'], 'Press P to resume', PALETTE.cyan);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Harbor PD caught up with you.', 'You paid a fine and you are back on the streets.'], 'Press ENTER to keep playing', PALETTE.danger);
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Your ride is scrap metal.', 'You paid a fine and you are back on the streets.'], 'Press ENTER to keep playing', PALETTE.danger);
    } else if (state.allDone && screen === SCREEN_PLAY) {
      ctx.font = font(34, true);
      const label = '★ ALL MISSIONS COMPLETE ★';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(12,10,24,0.8)';
      ctx.fillRect((vw - tw) / 2 - 20, vh / 2 - 110, tw + 40, 56);
      text(label, vw / 2, vh / 2 - 70, 34, PALETTE.gold, 'center', true);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
