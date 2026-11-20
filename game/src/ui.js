// Screens and dialogue: title, pause, wasted, busted, and the subtitle line that
// carries the story. The world owns the simulation; this owns what the player is
// looking at and what they are told.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

export function createUi() {
  const ui = {
    screen: SCREEN_TITLE,
    subtitle: '',
    subtitleTime: 0,
    banner: '',
    bannerTime: 0,
    bannerColor: '#ffd23e',
    help: true, // control hints fade out after the first minute of play
    helpTime: 60,
  };

  function say(text, seconds) {
    ui.subtitle = text;
    ui.subtitleTime = seconds || 4;
  }

  function showBanner(text, color, seconds) {
    ui.banner = text;
    ui.bannerTime = seconds || 3;
    ui.bannerColor = color || '#ffd23e';
  }

  function step(dt) {
    if (ui.subtitleTime > 0) ui.subtitleTime -= dt;
    if (ui.bannerTime > 0) ui.bannerTime -= dt;
    if (ui.help && ui.helpTime > 0) ui.helpTime -= dt;
  }

  return { ui, say, showBanner, step };
}
