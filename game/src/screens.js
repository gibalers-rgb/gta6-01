// Screens and dialogue: title, pause, wasted, busted, plus the subtitle line
// that carries the story and the banner that celebrates (or mourns) a job.
// The world owns the simulation; this owns what the player is looking at and
// what they are told.
export const SCR_TITLE = 'title';
export const SCR_PLAY = 'play';
export const SCR_PAUSED = 'paused';
export const SCR_WASTED = 'wasted';
export const SCR_BUSTED = 'busted';

export function makeScreens() {
  const ui = {
    line: '',
    lineT: 0,
    flag: '',
    flagT: 0,
    flagColor: '#ffd23e',
    hints: true, // control hints fade out after the first minute of play
    hintsT: 60,
  };

  function say(text, seconds) {
    ui.line = text;
    ui.lineT = seconds || 4;
  }

  function showFlag(text, color, seconds) {
    ui.flag = text;
    ui.flagT = seconds || 3;
    ui.flagColor = color || '#ffd23e';
  }

  function tick(dt) {
    if (ui.lineT > 0) ui.lineT -= dt;
    if (ui.flagT > 0) ui.flagT -= dt;
    if (ui.hints && ui.hintsT > 0) ui.hintsT -= dt;
  }

  /** A fresh game gets the control hints again, for a full minute. */
  function resetHints() {
    ui.hints = true;
    ui.hintsT = 60;
  }

  return { ui, say, showFlag, tick, resetHints };
}
