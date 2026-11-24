// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { ax: 0, ay: 0, run: false, actions: 0, aim: 0 };
const DRIVE = { ax: 0, ay: -1, run: false, actions: 0, aim: 0 };

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < 5 / STEP; i++) world.step(STEP, IDLE);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    // Player already behind the wheel, speeding east along Harbor Road with two
    // police units closing in and a 2-star wanted level.
    const car = state.cars[0];
    car.x = 900; car.y = 300; car.angle = 0; car.speed = 420; car.driver = 'player';
    state.player.onFoot = false; state.player.car = car;
    state.player.x = car.x; state.player.y = car.y; state.player.angle = 0;
    state.player.wanted = 2; state.player.crimeTimer = 0;
    state.player.money = 1150;
    for (let i = 0; i < 5 / STEP; i++) world.step(STEP, DRIVE);
    return { screen: SCREEN_PLAY };
  }
  // end: all three missions done, player parked by the lighthouse at sunset.
  const car = state.cars[0];
  car.x = 2140; car.y = 1500; car.angle = -Math.PI / 2; car.speed = 0; car.driver = 'player';
  state.player.onFoot = false; state.player.car = car;
  state.player.x = car.x; state.player.y = car.y; state.player.angle = car.angle;
  state.player.money = 5200;
  state.mission = 3; state.allDone = true;
  for (let i = 0; i < 2 / STEP; i++) world.step(STEP, IDLE);
  // No floating banner here: the renderer paints the big centre banner itself.
  state.banner = ''; state.bannerT = 0;
  return { screen: SCREEN_PLAY };
}
