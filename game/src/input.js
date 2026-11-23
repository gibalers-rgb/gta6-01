// Keyboard and pointer input, driven by a table: each physical key maps to a
// named action, and the game asks about actions, never about key codes.
// One-shot actions (confirm, pause, enter, talk, horn) are latched and taken
// once, so a press between two frames is never lost and never counted twice.
export const ACT_CONFIRM = 'confirm';
export const ACT_PAUSE = 'pause';
export const ACT_ENTER = 'enter';
export const ACT_TALK = 'talk';
export const ACT_HORN = 'horn';

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'confirm', Enter: 'confirm',
  KeyP: 'pause', Escape: 'pause',
  KeyE: 'enter', KeyF: 'enter',
  KeyQ: 'talk',
  KeyH: 'horn',
};

const ONE_SHOT = new Set(['confirm', 'pause', 'enter', 'talk', 'horn']);

export function makeInput(target) {
  const down = new Set();
  const latched = new Set();
  const pointer = { x: 0, y: 0, isDown: false };
  let clicked = false;
  let spaceHeld = false; // Space doubles as the handbrake while driving

  function keyOn(code) {
    if (code === 'Space') spaceHeld = true;
    const action = KEYMAP[code];
    if (!action) return;
    down.add(action);
    if (ONE_SHOT.has(action)) latched.add(action);
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keyOn(event.code);
    const action = KEYMAP[event.code];
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') spaceHeld = false;
    const action = KEYMAP[event.code];
    if (action) down.delete(action);
  });
  window.addEventListener('blur', () => {
    down.clear();
    pointer.isDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    pointer.isDown = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    clicked = true;
    latched.add('confirm');
  });
  window.addEventListener('pointerup', () => {
    pointer.isDown = false;
  });

  return {
    /** Movement vector, each axis -1/0/1. */
    moveVec() {
      return {
        x: (down.has('right') ? 1 : 0) - (down.has('left') ? 1 : 0),
        y: (down.has('down') ? 1 : 0) - (down.has('up') ? 1 : 0),
      };
    },
    sprinting() {
      return down.has('sprint');
    },
    /** -1 brake/reverse, 1 throttle, 0 neither. */
    throttle() {
      return (down.has('up') ? 1 : 0) - (down.has('down') ? 1 : 0);
    },
    /** -1 left, 1 right. */
    steer() {
      return (down.has('right') ? 1 : 0) - (down.has('left') ? 1 : 0);
    },
    handbrake() {
      return spaceHeld;
    },
    pointer() {
      return pointer;
    },
    /** True once after a click (aim / shoot on foot). */
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
    /** The latched one-shot actions since the last call. */
    takeActions() {
      const taken = new Set(latched);
      latched.clear();
      return taken;
    },
    hasAction(name) {
      return down.has(name);
    },
  };
}
