// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between title, play, paused, busted and wasted screens.
//
// ?seed=N fixes the city. ?shot=start|play|end (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_MISSION,
  EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED,
} from './world.js';
import {
  ACT_CONFIRM, ACT_ENTER_CAR, ACT_MUTE, ACT_PAUSE, ACT_PUNCH, ACT_SHOOT, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave() {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave())); } catch { /* storage can be off */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { hasSave: false, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let continuePressed = false;
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && !event.repeat) continuePressed = true;
  });

  function announce(message) { status.textContent = message; }

  function startGame(fresh) {
    world.reset();
    if (!fresh && save) world.applySave(save);
    accumulator = 0;
    saveTimer = 0;
    screen = SCREEN_PLAY;
    announce(fresh ? 'Playing Neon Harbor.' : 'Continuing your saved game.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACT_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACT_CONFIRM) { audio.unlock(); startGame(true); }
      else if (continuePressed && save) { audio.unlock(); startGame(false); }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACT_CONFIRM) { world.respawn(); screen = SCREEN_PLAY; announce('Back on the streets.'); }
    } else if (actions & ACT_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED; announce('Paused.');
    } else if (actions & (ACT_PAUSE | ACT_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY; announce('Playing.');
    }
    continuePressed = false;
    return actions;
  }

  function aimAngle() {
    const p = world.state.player;
    const vw = window.innerWidth, vh = window.innerHeight;
    let camX = clamp(p.x - vw / 2, 0, WORLD.width - vw);
    let camY = clamp(p.y - vh / 2, 0, WORLD.height - vh);
    if (camX < 0) camX = (WORLD.width - vw) / 2;
    if (camY < 0) camY = (WORLD.height - vh) / 2;
    const m = input.mouse();
    const sx = p.x - camX, sy = p.y - camY;
    return Math.atan2(m.y - sy, m.x - sx);
  }

  function step(actions) {
    const axes = input.axes();
    const ctrl = {
      ax: axes.x, ay: axes.y, run: axes.run,
      actions: actions & (ACT_ENTER_CAR | ACT_PUNCH | ACT_SHOOT),
      aim: aimAngle(),
    };
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { ax: 0, ay: 0, run: false, actions: 0, aim: 0 });
      return;
    }
    const events = world.step(STEP, ctrl);
    if (events & EVENT_MISSION) { audio.mission(); announce('Mission complete.'); }
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & (EVENT_PICKUP | EVENT_CASH)) audio.pickup();
    if (events & EVENT_BUSTED) { audio.busted(); screen = SCREEN_BUSTED; announce('Busted by the police.'); }
    if (events & EVENT_WASTED) { audio.busted(); screen = SCREEN_WASTED; announce('Wasted. Your car is scrap.'); }
    if (screen === SCREEN_PLAY) {
      saveTimer += STEP;
      if (saveTimer >= 30) { saveTimer = 0; writeSave(); }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = world.state.player;
    audio.engine(p.onFoot ? 0 : Math.abs(p.speed || 0) / 560, !p.onFoot);
    audio.siren(p.wanted, STEP);
    renderer.draw(world.state, screen, { hasSave: !!save, muted: audio.muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  announce('Neon Harbor. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
