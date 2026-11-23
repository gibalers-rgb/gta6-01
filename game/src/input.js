// Solmar Heat — keyboard input.
// Tracks held keys and one-frame "just pressed" edges so the game can tell
// a tap (steal a car, start, pause) from a hold (drive, run).

const held = new Set();
const pressed = new Set();

const CODE_ALIASES = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'action',
  Enter: 'start',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
};

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.code in CODE_ALIASES) e.preventDefault();
    if (!e.repeat) pressed.add(CODE_ALIASES[e.code] || e.code);
    held.add(CODE_ALIASES[e.code] || e.code);
  });
  window.addEventListener('keyup', (e) => {
    held.delete(CODE_ALIASES[e.code] || e.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
}

export function isDown(action) {
  return held.has(action);
}

export function wasPressed(action) {
  return pressed.has(action);
}

// Called once per frame after the game has read the edges.
export function endFrameInput() {
  pressed.clear();
}
