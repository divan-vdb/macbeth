// The title card: the first tap also wakes the sound, so the Old Man can speak.
export function showTitle({ hasSave, onChoose }) {
  const view = document.createElement('div');
  view.className = 'overlay title-view';
  view.innerHTML = `
    <div class="inner">
      <h1>MACBETH</h1>
      <div class="sub">Thunder and lightning. A heath in Scotland.</div>
      <div class="choices">
        ${hasSave ? '<button type="button" data-c="continue">Continue<small>Return to where you left the heath</small></button>' : ''}
        <button type="button" data-c="learn">${hasSave ? 'New game: ' : ''}Play and learn the play<small>The Folio follows every scene, with notes and a glossary</small></button>
        <button type="button" data-c="play">${hasSave ? 'New game: ' : ''}Just play<small>The story and the game, the play's text kept in the background</small></button>
      </div>
      <div class="note">Sound on is best. You can change any of this later in Settings.</div>
      <div class="credit">A game by Divan van den Berg</div>
    </div>`;
  document.body.appendChild(view);
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    view.remove();
    onChoose(b.dataset.c);
  });
}
