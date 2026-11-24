// Neon Harbor rules and state: no drawing, no browser in here. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react (sounds,
// announcements) without the world knowing about screens. The city is generated once
// from the seeded RNG; reset() only restores the dynamic state.
import {
  ARREST_TIME, BEACH_Y, BUILDING_COLORS, CAR, CAR_COLORS, MISSIONS, PED_COUNT,
  PLAYER, ROADS_H, ROADS_V, ROAD_W, TRAFFIC_COUNT, WANTED_DECAY, WATER_Y, WORLD,
} from './config.js';
import { pick, randInt, randRange } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_CRIME = 2;
export const EVENT_MISSION = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WASTED = 16;
export const EVENT_CRASH = 32;
export const EVENT_SHOT = 64;
export const EVENT_PUNCH = 128;
export const EVENT_CASH = 256;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function angleDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function circleRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.y, b.y + b.h);
  const dx = cx - nx, dy = cy - ny;
  return { hit: dx * dx + dy * dy < r * r, nx, ny, dx, dy };
}

const BLOCK_X = [[40, 245], [355, 845], [955, 1445], [1555, 2045], [2155, 2360]];
const BLOCK_Y = [[40, 245], [355, 745], [855, 1245], [1355, 1545]];

export function createWorld(random) {
  // ---- static city -------------------------------------------------------
  const buildings = [];
  for (let bx = 0; bx < BLOCK_X.length; bx++) {
    for (let by = 0; by < BLOCK_Y.length; by++) {
      // NW block is the hideout plaza, the (1,1) block is the park: no buildings.
      if ((bx === 0 && by === 0) || (bx === 1 && by === 1)) continue;
      const [x0, x1] = BLOCK_X[bx], [y0, y1] = BLOCK_Y[by];
      const cols = x1 - x0 > 380 ? 2 : 1, rows = y1 - y0 > 320 ? 2 : 1;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const w = (x1 - x0) / cols, h = (y1 - y0) / rows;
          const bw = w - 26 - random() * 30, bh = h - 26 - random() * 30;
          buildings.push({
            x: x0 + cx * w + 13 + random() * 10, y: y0 + cy * h + 13 + random() * 10,
            w: bw, h: bh, color: pick(random, BUILDING_COLORS), hgt: 8 + random() * 22,
          });
        }
      }
    }
  }
  const trees = [];
  for (let i = 0; i < 90; i++) {
    const x = 30 + random() * (WORLD.width - 60), y = 30 + random() * (BEACH_Y - 60);
    if (onRoad(x, y) || buildingAt(x, y, 12)) continue;
    trees.push({ x, y, s: 0.8 + random() * 0.7 });
  }
  // Park trees, denser.
  for (let i = 0; i < 26; i++) trees.push({ x: 380 + random() * 440, y: 380 + random() * 340, s: 0.9 + random() * 0.8 });

  function onRoad(x, y) {
    for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_W / 2 + 14) return true;
    for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_W / 2 + 14) return true;
    return false;
  }
  function buildingAt(x, y, r) {
    for (const b of buildings) {
      if (circleRect(x, y, r, b).hit) return b;
    }
    return null;
  }
  function collideBuildings(e, r) {
    // Push a circle entity out of buildings; returns impact speed-ish flag.
    let hit = false;
    for (const b of buildings) {
      const c = circleRect(e.x, e.y, r, b);
      if (!c.hit) continue;
      hit = true;
      const d = Math.hypot(c.dx, c.dy) || 1;
      const push = r - d + 0.5;
      if (d < 0.01) { e.y = b.y - r - 0.5; continue; }
      e.x += (c.dx / d) * push; e.y += (c.dy / d) * push;
    }
    return hit;
  }

  // ---- dynamic state -----------------------------------------------------
  const player = {
    x: 480, y: 380, angle: -Math.PI / 2, speed: 0, health: PLAYER.health,
    onFoot: true, car: null, hasGun: false, ammo: 0, money: 250,
    wanted: 0, crimeTimer: 0, arrestTimer: 0, punchCd: 0, shootCd: 0, punchAnim: 0,
  };
  const state = {
    player, buildings, trees, cars: [], peds: [], bullets: [], particles: [],
    skids: [], pickups: [], mission: 0, missionTimer: 0, time: 0,
    over: null, banner: '', bannerT: 0, shake: 0, policeTimer: 0, saveTimer: 0,
    allDone: false,
  };

  function spawnCar(x, y, angle, color, police, ai) {
    const car = {
      id: state.cars.length, x, y, angle, speed: 0, color: color || pick(random, CAR_COLORS),
      police: !!police, hp: police ? 60 : CAR.hp, driver: null, ai: ai || null,
      smoke: 0, crashCd: 0, disabled: false, despawn: 0,
    };
    state.cars.push(car);
    return car;
  }
  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    let x, y, angle;
    if (vertical) {
      const rx = pick(random, ROADS_V);
      x = rx + (random() < 0.5 ? -27 : 27);
      y = 40 + random() * (WORLD.height - 80);
      angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = pick(random, ROADS_H);
      y = ry + (random() < 0.5 ? -27 : 27);
      x = 40 + random() * (WORLD.width - 80);
      angle = random() < 0.5 ? 0 : Math.PI;
    }
    const car = spawnCar(x, y, angle, null, false, { vertical, speed: 90 + random() * 60 });
    car.driver = 'ai';
    car.speed = car.ai.speed;
    return car;
  }
  function spawnPed() {
    let x, y, tries = 0;
    do {
      x = 30 + random() * (WORLD.width - 60);
      y = 30 + random() * (BEACH_Y - 60);
      tries++;
    } while ((onRoad(x, y) || buildingAt(x, y, 14)) && tries < 20);
    return {
      x, y, angle: random() * TAU, speed: 0, state: 'walk', tx: x, ty: y,
      timer: randRange(random, 1, 4), down: 0,
      color: pick(random, ['#f5d0a9', '#8d5524', '#e8b88a', '#c68642', '#ffdbac']),
      shirt: pick(random, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1']),
    };
  }
  function addParticles(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = random() * TAU, s = (speed || 120) * (0.4 + random() * 0.8);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + random() * 0.5, max: 0.9, color, size: 2 + random() * 4 });
    }
    if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
  }
  function addCrime(n, x, y) {
    if (player.wanted < 5) player.wanted = Math.min(5, player.wanted + n);
    player.crimeTimer = 0;
    if (x !== undefined) {
      for (const p of state.peds) {
        if (p.state !== 'down' && dist(p.x, p.y, x, y) < 320) { p.state = 'flee'; p.timer = 3; }
      }
    }
    return EVENT_CRIME;
  }
  function nearestRoadPoint(x, y) {
    let best = null, bd = Infinity;
    for (const rx of ROADS_V) {
      const d = Math.abs(x - rx);
      if (d < bd) { bd = d; best = { x: rx, y: clamp(y, 60, WORLD.height - 60) }; }
    }
    for (const ry of ROADS_H) {
      const d = Math.abs(y - ry);
      if (d < bd) { bd = d; best = { x: clamp(x, 60, WORLD.width - 60), y: ry }; }
    }
    return best;
  }
  function spawnPolice() {
    const want = Math.min(5, player.wanted + (player.wanted >= 3 ? 1 : 0));
    const have = state.cars.filter((c) => c.police && !c.disabled).length;
    for (let i = have; i < want; i++) {
      const p = nearestRoadPoint(player.x + (random() - 0.5) * 900, player.y + (random() - 0.5) * 900);
      const ang = Math.atan2(player.y - p.y, player.x - p.x);
      const car = spawnCar(p.x, p.y, ang, '#1c2733', true, null);
      car.driver = 'police';
      car.speed = 200;
    }
  }
  function damageCar(car, amount, fromX, fromY) {
    car.hp -= amount;
    car.smoke = Math.max(car.smoke, 0.6);
    addParticles(car.x, car.y, 8, '#ffb347', 160);
    if (car.hp <= 0 && !car.disabled) {
      car.disabled = true; car.despawn = 5; car.speed = 0;
      addParticles(car.x, car.y, 26, '#ff6b35', 220);
      state.shake = Math.max(state.shake, 10);
    }
  }

  function reset() {
    player.x = 480; player.y = 380; player.angle = -Math.PI / 2; player.speed = 0;
    player.health = PLAYER.health; player.onFoot = true; player.car = null;
    player.hasGun = false; player.ammo = 0; player.money = 250; player.wanted = 0;
    player.crimeTimer = 0; player.arrestTimer = 0; player.punchCd = 0; player.shootCd = 0;
    state.cars.length = 0; state.peds.length = 0; state.bullets.length = 0;
    state.particles.length = 0; state.skids.length = 0;
    state.pickups = [
      { x: 600, y: 560, kind: 'gun', taken: false },
      { x: 1750, y: 1050, kind: 'ammo', taken: false },
      { x: 1150, y: 1150, kind: 'cash', taken: false },
    ];
    state.mission = 0; state.missionTimer = 0; state.time = 0; state.over = null;
    state.banner = ''; state.bannerT = 0; state.shake = 0; state.policeTimer = 0; state.saveTimer = 0;
    state.allDone = false;
    // Starter car parked by the road, unlocked.
    const starter = spawnCar(520, 300, 0, '#e74c3c', false, null);
    starter.driver = null;
    for (let i = 0; i < TRAFFIC_COUNT; i++) spawnTrafficCar();
    for (let i = 0; i < PED_COUNT; i++) state.peds.push(spawnPed());
  }

  function respawn() {
    const fine = Math.floor(player.money * 0.2);
    player.money -= fine;
    player.x = 480; player.y = 380; player.angle = -Math.PI / 2; player.health = PLAYER.health;
    player.onFoot = true; player.car = null; player.wanted = 0; player.arrestTimer = 0;
    player.crimeTimer = 0;
    for (const c of state.cars) if (c.police) { c.disabled = true; c.despawn = 0.1; }
    state.over = null;
    state.banner = state.over === 'busted' ? 'BUSTED' : 'WASTED';
    state.banner = `You paid a $${fine} fine. Back on the streets.`;
    state.bannerT = 3;
  }

  function missionTarget() { return state.mission < 3 ? MISSIONS[state.mission].target : null; }

  function completeMission() {
    const m = MISSIONS[state.mission];
    player.money += m.reward;
    state.banner = `Mission complete: ${m.name}  +$${m.reward}`;
    state.bannerT = 4;
    state.mission += 1;
    if (state.mission === 1) { player.wanted = Math.max(player.wanted, 2); player.crimeTimer = 0; spawnPolice(); }
    if (state.mission === 2) state.missionTimer = MISSIONS[2].time;
    if (state.mission >= 3) { state.allDone = true; state.banner = 'ALL MISSIONS COMPLETE — Neon Harbor is yours'; state.bannerT = 5; }
    return EVENT_MISSION;
  }

  function step(dt, ctrl) {
    let events = 0;
    state.time += dt;
    if (state.bannerT > 0) state.bannerT -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
    if (player.punchCd > 0) player.punchCd -= dt;
    if (player.shootCd > 0) player.shootCd -= dt;
    if (player.punchAnim > 0) player.punchAnim -= dt;

    // ---- player on foot --------------------------------------------------
    if (player.onFoot) {
      const sp = ctrl.run ? PLAYER.run : PLAYER.walk;
      const mx = ctrl.ax, my = ctrl.ay;
      const len = Math.hypot(mx, my);
      if (len > 0.01) {
        player.angle = Math.atan2(my, mx);
        player.x += (mx / len) * sp * dt;
        player.y += (my / len) * sp * dt;
        player.speed = sp;
      } else player.speed = 0;
      player.x = clamp(player.x, 16, WORLD.width - 16);
      player.y = clamp(player.y, 16, WATER_Y - 20);
      collideBuildings(player, PLAYER.radius);
      if (ctrl.actions & 2) { // E: enter nearest car
        let best = null, bd = 110;
        for (const c of state.cars) {
          if (c.disabled) continue;
          const d = dist(player.x, player.y, c.x, c.y);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) {
          if (best.driver === 'ai') { // steal: driver bails and runs
            events |= addCrime(1, best.x, best.y);
            const ped = spawnPed(); ped.x = best.x + 30; ped.y = best.y; ped.state = 'flee'; ped.timer = 4;
            state.peds.push(ped);
          }
          best.driver = 'player';
          player.car = best;
          player.onFoot = false;
          player.x = best.x; player.y = best.y; player.angle = best.angle;
        }
      }
      if (ctrl.actions & 4) { // Space: punch
        if (player.punchCd <= 0) {
          player.punchCd = PLAYER.punchCd; player.punchAnim = 0.22;
          events |= EVENT_PUNCH;
          const px = player.x + Math.cos(player.angle) * 34, py = player.y + Math.sin(player.angle) * 34;
          for (const p of state.peds) {
            if (p.state === 'down') continue;
            const d = dist(px, py, p.x, p.y);
            const ang = Math.abs(angleDiff(Math.atan2(p.y - player.y, p.x - player.x), player.angle));
            if (d < PLAYER.punchRange && ang < PLAYER.punchArc) {
              p.state = 'down'; p.down = 4;
              events |= addCrime(1, p.x, p.y);
              addParticles(p.x, p.y, 10, '#ffe08a', 140);
            }
          }
          for (const c of state.cars) {
            if (!c.police || c.disabled) continue;
            if (dist(px, py, c.x, c.y) < 60) {
              damageCar(c, 8); events |= addCrime(1, c.x, c.y);
            }
          }
        }
      }
      if (ctrl.actions & 8) { // F / click: shoot
        if (player.hasGun && player.ammo > 0 && player.shootCd <= 0) {
          player.shootCd = PLAYER.shootCd; player.ammo -= 1;
          const a = ctrl.aim !== undefined ? ctrl.aim : player.angle;
          const bx = player.x + Math.cos(a) * 24, by = player.y + Math.sin(a) * 24;
          state.bullets.push({ x: bx, y: by, vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed, life: PLAYER.bulletRange / PLAYER.bulletSpeed });
          addParticles(bx, by, 5, '#ffe08a', 90);
          events |= EVENT_SHOT;
        }
      }
      // Pickups.
      for (const pk of state.pickups) {
        if (pk.taken) continue;
        if (dist(player.x, player.y, pk.x, pk.y) < 34) {
          pk.taken = true; events |= EVENT_PICKUP;
          if (pk.kind === 'gun') { player.hasGun = true; player.ammo += 12; state.banner = 'Picked up a pistol — F or click to shoot'; state.bannerT = 3; }
          if (pk.kind === 'ammo') { player.ammo += 24; player.hasGun = true; state.banner = 'Picked up ammo +24'; state.bannerT = 3; }
          if (pk.kind === 'cash') { player.money += 100; events |= EVENT_CASH; state.banner = 'Found $100 cash'; state.bannerT = 3; }
        }
      }
    } else {
      // ---- player driving ------------------------------------------------
      const car = player.car;
      if (!car || car.disabled) {
        player.onFoot = true; player.car = null;
        if (car && car.disabled && car.hp <= 0) { state.over = 'wasted'; return EVENT_WASTED; }
      } else {
        const fwd = ctrl.ay < 0 ? 1 : ctrl.ay > 0 ? -0.55 : 0; // W gas, S brake/reverse
        const steer = ctrl.ax;
        const speedBefore = car.speed;
        if (fwd > 0) car.speed += CAR.accel * dt;
        else if (fwd < 0) car.speed += (car.speed > 0 ? -CAR.brake : -CAR.reverse) * dt;
        else car.speed -= car.speed * 0.9 * dt;
        car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
        const turnAuthority = clamp(Math.abs(car.speed) / 140, 0, 1) * (car.speed < 0 ? -1 : 1);
        car.angle += steer * CAR.turnRate * turnAuthority * dt;
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        car.x = nx; car.y = ny;
        car.x = clamp(car.x, 20, WORLD.width - 20);
        car.y = clamp(car.y, 20, WATER_Y - 24);
        if (Math.abs(car.speed) > 300 && steer !== 0) {
          state.skids.push({ x: car.x, y: car.y, a: car.angle, life: 1.2 });
          if (state.skids.length > 220) state.skids.shift();
        }
        if (collideBuildings(car, 34)) {
          if (Math.abs(speedBefore) > 260) {
            car.hp -= Math.floor(Math.abs(speedBefore) / 40);
            addParticles(car.x, car.y, 14, '#ffb347', 200);
            state.shake = Math.max(state.shake, 6);
            events |= EVENT_CRASH;
            if (car.hp <= 0) { damageCar(car, 0); state.over = 'wasted'; return EVENT_WASTED; }
          }
          car.speed *= -0.25;
        }
        player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = Math.abs(car.speed);
        if (car.hp < 55) {
          car.smoke = Math.max(car.smoke, 0.3);
          if (random() < 0.3) addParticles(car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30, 1, '#888888', 40);
        }
        if (ctrl.actions & 2) { // E: get out
          car.driver = null; car.speed = 0;
          player.onFoot = true; player.car = null;
          player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
          player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
          player.x = clamp(player.x, 16, WORLD.width - 16);
          player.y = clamp(player.y, 16, WATER_Y - 20);
        }
      }
    }

    // ---- traffic AI ------------------------------------------------------
    for (const c of state.cars) {
      if (c.driver !== 'ai' || c.disabled) continue;
      const v = c.ai.vertical;
      c.speed = c.ai.speed;
      if (v) {
        c.y += Math.sin(c.angle) * c.speed * dt;
        if (c.y < 30 || c.y > WORLD.height - 30) { c.y = c.y < 30 ? WORLD.height - 40 : 40; }
      } else {
        c.x += Math.cos(c.angle) * c.speed * dt;
        if (c.x < 30 || c.x > WORLD.width - 30) { c.x = c.x < 30 ? WORLD.width - 40 : 40; }
      }
      // Bump into buildings at road ends is impossible (they stay on roads), but
      // a shove from a crash can push them off: nudge back onto the road.
      if (!onRoad(c.x, c.y)) {
        const p = nearestRoadPoint(c.x, c.y);
        c.x += (p.x - c.x) * dt * 2; c.y += (p.y - c.y) * dt * 2;
      }
    }

    // ---- police AI -------------------------------------------------------
    if (player.wanted > 0) {
      state.policeTimer -= dt;
      if (state.policeTimer <= 0) { spawnPolice(); state.policeTimer = 4; }
    }
    let nearestPolice = Infinity;
    for (const c of state.cars) {
      if (!c.police) continue;
      if (c.disabled) {
        c.despawn -= dt;
        if (c.despawn <= 0) { const i = state.cars.indexOf(c); if (i >= 0) state.cars.splice(i, 1); }
        continue;
      }
      if (c.smoke > 0) c.smoke -= dt;
      const d = dist(c.x, c.y, player.x, player.y);
      nearestPolice = Math.min(nearestPolice, d);
      const wantAngle = Math.atan2(player.y - c.y, player.x - c.x);
      const diff = angleDiff(wantAngle, c.angle);
      c.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const targetSpeed = Math.min(300 + player.wanted * 42, 520);
      c.speed += (targetSpeed - c.speed) * dt * 0.8;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      c.x = clamp(c.x, 20, WORLD.width - 20);
      c.y = clamp(c.y, 20, WATER_Y - 24);
      collideBuildings(c, 32);
      if (player.onFoot && d < 48) {
        player.arrestTimer += dt;
        if (player.arrestTimer >= ARREST_TIME) { state.over = 'busted'; return EVENT_BUSTED; }
      } else if (player.arrestTimer > 0) player.arrestTimer = Math.max(0, player.arrestTimer - dt * 2);
    }
    if (player.onFoot) player.arrestTimer = player.onFoot ? player.arrestTimer : 0;

    // ---- car vs car collisions -------------------------------------------
    for (let i = 0; i < state.cars.length; i++) {
      const a = state.cars[i];
      if (a.disabled) continue;
      for (let j = i + 1; j < state.cars.length; j++) {
        const b = state.cars[j];
        if (b.disabled) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 62 && d > 0.01) {
          const push = (62 - d) / 2;
          const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 200 && (a.crashCd <= 0 || b.crashCd <= 0)) {
            a.crashCd = 0.5; b.crashCd = 0.5;
            addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 10, '#ffd166', 160);
            state.shake = Math.max(state.shake, 4);
            events |= EVENT_CRASH;
            const playerCar = a.driver === 'player' ? a : b.driver === 'player' ? b : null;
            const other = playerCar === a ? b : a;
            if (playerCar) {
              playerCar.hp -= Math.floor(rel / 45);
              if (other.police) damageCar(other, Math.floor(rel / 60));
              if (playerCar.hp <= 0) { damageCar(playerCar, 0); state.over = 'wasted'; return EVENT_WASTED; }
            } else if (a.police || b.police) {
              damageCar(a.police ? a : b, Math.floor(rel / 60));
            }
            a.speed *= 0.6; b.speed *= 0.6;
          }
        }
      }
    }
    for (const c of state.cars) if (c.crashCd > 0) c.crashCd -= dt;

    // ---- player car vs pedestrians ---------------------------------------
    if (!player.onFoot) {
      const car = player.car;
      if (car) {
        for (const p of state.peds) {
          if (p.state === 'down') continue;
          if (dist(car.x, car.y, p.x, p.y) < 40 && Math.abs(car.speed) > 60) {
            p.state = 'down'; p.down = 5;
            events |= addCrime(1, p.x, p.y);
            addParticles(p.x, p.y, 12, '#ff8a8a', 150);
            state.shake = Math.max(state.shake, 5);
          }
        }
      }
    }

    // ---- pedestrians -----------------------------------------------------
    for (const p of state.peds) {
      if (p.state === 'down') {
        p.down -= dt;
        if (p.down <= 0) { p.state = 'flee'; p.timer = 3; }
        continue;
      }
      if (p.state === 'flee') {
        p.timer -= dt;
        const a = Math.atan2(p.y - player.y, p.x - player.x);
        p.x += Math.cos(a) * 230 * dt; p.y += Math.sin(a) * 230 * dt;
        p.angle = a;
        if (p.timer <= 0) p.state = 'walk';
      } else {
        p.timer -= dt;
        if (p.timer <= 0) {
          let tx, ty, tries = 0;
          do {
            tx = clamp(p.x + randRange(random, -260, 260), 30, WORLD.width - 30);
            ty = clamp(p.y + randRange(random, -260, 260), 30, BEACH_Y - 30);
            tries++;
          } while ((onRoad(tx, ty) || buildingAt(tx, ty, 14)) && tries < 12);
          p.tx = tx; p.ty = ty; p.timer = randRange(random, 2, 6);
        }
        const d = dist(p.x, p.y, p.tx, p.ty);
        if (d > 8) {
          p.angle = Math.atan2(p.ty - p.y, p.tx - p.x);
          p.x += Math.cos(p.angle) * 62 * dt; p.y += Math.sin(p.angle) * 62 * dt;
        }
      }
      p.x = clamp(p.x, 16, WORLD.width - 16);
      p.y = clamp(p.y, 16, WATER_Y - 20);
      collideBuildings(p, 12);
    }

    // ---- bullets ---------------------------------------------------------
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WATER_Y;
      if (!dead) {
        if (buildingAt(b.x, b.y, 2)) { dead = true; addParticles(b.x, b.y, 5, '#cccccc', 100); }
        for (const p of state.peds) {
          if (p.state !== 'down' && dist(b.x, b.y, p.x, p.y) < 16) {
            p.state = 'down'; p.down = 5; dead = true;
            events |= addCrime(1, p.x, p.y);
            addParticles(b.x, b.y, 10, '#ff8a8a', 140);
            break;
          }
        }
        if (!dead) {
          for (const c of state.cars) {
            if (c.disabled || c.driver === 'player') continue;
            if (dist(b.x, b.y, c.x, c.y) < 34) {
              dead = true;
              damageCar(c, PLAYER.bulletDmg);
              if (c.police) events |= addCrime(1, c.x, c.y);
              break;
            }
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // ---- particles & skids -----------------------------------------------
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.skids.length - 1; i >= 0; i--) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }

    // ---- wanted decay ----------------------------------------------------
    if (player.wanted > 0 && !state.over) {
      player.crimeTimer += dt;
      if (player.crimeTimer > WANTED_DECAY && nearestPolice > 520) {
        player.wanted -= 1; player.crimeTimer = 0;
        state.banner = player.wanted === 0 ? 'You lost the heat' : `Wanted level dropped to ${player.wanted}`;
        state.bannerT = 2.5;
      }
    }

    // ---- missions --------------------------------------------------------
    if (!state.over && state.mission < 3) {
      const m = MISSIONS[state.mission];
      const target = m.target;
      const px = player.x, py = player.y;
      if (state.mission === 0) {
        if (dist(px, py, target.x, target.y) < 64) events |= completeMission();
      } else if (state.mission === 1) {
        if (dist(px, py, target.x, target.y) < 70 || player.wanted === 0) events |= completeMission();
      } else if (state.mission === 2) {
        state.missionTimer -= dt;
        if (dist(px, py, target.x, target.y) < 70) events |= completeMission();
        else if (state.missionTimer <= 0) {
          state.missionTimer = MISSIONS[2].time;
          state.banner = 'Too slow — the lighthouse run restarts';
          state.bannerT = 3;
        }
      }
    }

    return events;
  }

  function getSave() {
    return {
      money: player.money, mission: state.mission, x: player.x, y: player.y,
      hasGun: player.hasGun, ammo: player.ammo, health: player.health,
    };
  }
  function applySave(s) {
    player.money = s.money || 0;
    state.mission = Math.min(2, s.mission || 0);
    if (state.mission === 2) state.missionTimer = MISSIONS[2].time;
    player.x = clamp(s.x || 480, 16, WORLD.width - 16);
    player.y = clamp(s.y || 380, 16, WATER_Y - 20);
    player.hasGun = !!s.hasGun; player.ammo = s.ammo || 0;
    player.health = s.health || PLAYER.health;
  }

  reset();
  return { state, reset, step, respawn, missionTarget, getSave, applySave, addParticles };
}
