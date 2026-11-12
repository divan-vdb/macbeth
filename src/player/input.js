// One place that turns keyboard, mouse, touch and gamepad into:
//   move (x right, y forward, length 0..1), run, jump, look (dx, dy), zoom.
// Phones get a floating joystick on the left and a jump button on the right;
// dragging anywhere else turns the camera.

export const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function createInput(canvas, ui) {
  const keys = new Set();
  const look = { dx: 0, dy: 0 };
  let zoom = 0, jumpQueued = false;
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };

  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    keys.add(e.code);
    if (e.code === 'Space') {
      jumpQueued = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // Drag to look (mouse or any touch that isn't on the joystick)
  const drags = new Map();
  let pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener('pointermove', (e) => {
    const d = drags.get(e.pointerId);
    if (!d) return;
    if (drags.size === 2) {
      const [a, b] = [...drags.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      d.x = e.clientX;
      d.y = e.clientY;
      const [a2, b2] = [...drags.values()];
      const dist2 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      if (pinch !== null) zoom += (dist - dist2) * 0.02;
      pinch = dist2;
      return;
    }
    look.dx += e.clientX - d.x;
    look.dy += e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
  });
  const end = (e) => {
    drags.delete(e.pointerId);
    if (drags.size < 2) pinch = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    zoom += Math.sign(e.deltaY) * 0.6;
    e.preventDefault();
  }, { passive: false });

  // Phone joystick: appears where the left thumb lands
  if (isTouch && ui.stickZone) {
    const zone = ui.stickZone, base = ui.stickBase, knob = ui.stickKnob, R = 56;
    zone.addEventListener('pointerdown', (e) => {
      if (stick.id !== null) return;
      zone.setPointerCapture(e.pointerId);
      stick.id = e.pointerId;
      stick.ox = e.clientX;
      stick.oy = e.clientY;
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      base.classList.add('on');
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stick.id) return;
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx *= R / len;
        dy *= R / len;
      }
      stick.x = dx / R;
      stick.y = -dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const release = (e) => {
      if (e.pointerId !== stick.id) return;
      stick.id = null;
      stick.x = stick.y = 0;
      knob.style.transform = '';
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
    ui.jumpBtn.addEventListener('pointerdown', (e) => {
      jumpQueued = true;
      e.preventDefault();
    });
  }

  // Gamepad (standard mapping): left stick move, right stick look, A jump,
  // left-stick press or right trigger to run
  let padJumpHeld = false;
  function pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected && p.mapping === 'standard') return p;
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  const dead = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);

  return {
    read(dt) {
      let x = 0, y = 0, run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (stick.id !== null) {
        x = stick.x;
        y = stick.y;
        run = Math.hypot(x, y) > 0.85;
      }
      let lx = look.dx, ly = look.dy;
      const gp = pad();
      if (gp) {
        const ax = dead(gp.axes[0] || 0), ay = dead(gp.axes[1] || 0);
        if (Math.abs(ax) + Math.abs(ay) > 0) {
          x = ax;
          y = -ay;
        }
        lx += dead(gp.axes[2] || 0) * 900 * dt;
        ly += dead(gp.axes[3] || 0) * 600 * dt;
        if ((gp.buttons[7] && gp.buttons[7].value > 0.4) || (gp.buttons[10] && gp.buttons[10].pressed) || Math.hypot(ax, ay) > 0.92) run = true;
        const a = gp.buttons[0] && gp.buttons[0].pressed;
        if (a && !padJumpHeld) jumpQueued = true;
        padJumpHeld = a;
      }
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      const out = { x, y, run, jump: jumpQueued, lookX: lx, lookY: ly, zoom };
      look.dx = look.dy = 0;
      zoom = 0;
      jumpQueued = false;
      return out;
    },
  };
}
