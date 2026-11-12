// Quality presets with an automatic step-down: if the frame rate stays low for
// a few seconds, drop one level. Auto never steps back up on its own, so the
// picture doesn't keep changing; the player can pick a level by hand.
export const LEVELS = ['Low', 'Medium', 'High'];

export function createQuality({ renderer, grass, fire, narrow, onChange }) {
  let mode = 'Auto';
  let level = narrow ? 1 : 2;
  let lowTime = 0;
  const grassMax = grass.mesh.count;

  function apply() {
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio([Math.min(dpr, 1), Math.min(dpr, 1.5), Math.min(dpr, 2)][level]);
    grass.mesh.count = Math.round(grassMax * [0.35, 0.65, 1][level]);
    fire.light.castShadow = level === 2 && !narrow;
    onChange && onChange(label());
  }
  const label = () => (mode === 'Auto' ? `Auto (${LEVELS[level]})` : LEVELS[level]);

  apply();
  return {
    label,
    cycle() {
      // Auto -> Low -> Medium -> High -> Auto
      if (mode === 'Auto') {
        mode = 'Manual';
        level = 0;
      } else if (level < 2) level++;
      else {
        mode = 'Auto';
        level = narrow ? 1 : 2;
      }
      lowTime = 0;
      apply();
    },
    tick(dt, fps) {
      if (mode !== 'Auto' || level === 0) return;
      lowTime = fps < 40 ? lowTime + dt : Math.max(0, lowTime - dt * 0.5);
      if (lowTime > 3) {
        level--;
        lowTime = 0;
        apply();
      }
    },
  };
}
