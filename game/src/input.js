// Keyboard + pointer input. Held keys give movement axes; one-shot presses
// (enter/exit car, punch, shoot, confirm, pause, mute) are queued as bit flags
// and taken once by the loop, so a press between frames is never lost.
export const ACT_CONFIRM = 1;
export const ACT_ENTER_CAR = 2;
export const ACT_PUNCH = 4;
export const ACT_SHOOT = 8;
export const ACT_PAUSE = 16;
export const ACT_MUTE = 32;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) { if ([...UP, ...DOWN, ...LEFT, ...RIGHT].includes(event.code)) event.preventDefault(); return; }
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code); event.preventDefault();
    } else if (event.code === 'Enter' || event.code === 'NumpadEnter') actions |= ACT_CONFIRM;
    else if (event.code === 'KeyE') actions |= ACT_ENTER_CAR;
    else if (event.code === 'Space') { actions |= ACT_PUNCH; event.preventDefault(); }
    else if (event.code === 'KeyF') actions |= ACT_SHOOT;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  canvas.addEventListener('pointerdown', (event) => {
    mouse = { x: event.clientX, y: event.clientY, down: true };
    actions |= ACT_SHOOT;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  canvas.addEventListener('pointermove', (event) => { mouse.x = event.clientX; mouse.y = event.clientY; });

  const has = (set) => [...set].some((c) => held.has(c));
  return {
    axes() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
        run: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
    takeActions() { const t = actions; actions = 0; return t; },
    mouse() { return mouse; },
  };
}
