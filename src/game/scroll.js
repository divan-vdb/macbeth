// Reading a scroll: the parchment unrolls over the game, the Old Man reads it
// aloud (if voices are on), and its tasks go into the Folio's to-do list.
import { sfx, playClip } from '../audio.js';

export function openScroll({ title, intro, tasks, outro, sign, voice }, onClose) {
  const view = document.createElement('div');
  view.className = 'scroll-view';
  view.innerHTML = `
    <div class="sheet" role="dialog" aria-label="${title}">
      <h3>${title}</h3>
      <p>${intro}</p>
      <ol>${tasks.map((t) => `<li>${t}</li>`).join('')}</ol>
      ${outro ? `<p>${outro}</p>` : ''}
      <p class="sign">${sign}</p>
      <div class="seal"></div>
      <div class="row">
        ${voice ? '<button type="button" data-a="hush">Hush the old man</button>' : ''}
        <button type="button" data-a="close">Take up the tasks</button>
      </div>
    </div>`;
  document.body.appendChild(view);
  sfx('paper');
  let clip = null;
  if (voice) playClip(voice, { ch: 'narration' }).then((c) => (clip = c));
  const close = () => {
    if (!view.isConnected) return;
    if (clip) clip.stop();
    sfx('paper');
    view.remove();
    window.removeEventListener('keydown', key);
    onClose && onClose();
  };
  const key = (e) => {
    if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Enter') {
      e.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', key);
  view.addEventListener('click', (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (a === 'close') close();
    if (a === 'hush') {
      if (clip) clip.stop();
      e.target.remove();
    }
  });
  return { close };
}
