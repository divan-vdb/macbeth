// Saved progress and settings live in the browser (per device and browser).
// Every call is guarded: private modes and some embedded views refuse storage.
const GAME = 'macbeth-rpg.save.v1', SETTINGS = 'macbeth-rpg.settings.v1';
const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || null;
  } catch (e) {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) {
    return false;
  }
};
export const loadGame = () => read(GAME);
export const saveGame = (data) => write(GAME, { ...data, savedAt: Date.now() });
export const clearGame = () => {
  try {
    localStorage.removeItem(GAME);
  } catch (e) {
    /* nothing saved */
  }
};
export const loadSettings = () => read(SETTINGS);
export const saveSettings = (s) => write(SETTINGS, s);
