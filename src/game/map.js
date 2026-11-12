// The map: an inked parchment chart of the heath, drawn from the land itself
// (hill shading and contours), with the standing stones, the fire, the
// witches' cauldron, the tasks' markers and a red arrow for Macbeth.
// M opens and closes it; + and - zoom; Escape closes.

export function createMap({ heightAt, solids, fireAt, cauldronAt, getMarkers, getPlayer }) {
  const view = document.createElement('div');
  view.className = 'overlay map-view';
  view.hidden = true;
  view.innerHTML = `<div class="sheet"><canvas width="1024" height="1024"></canvas><div class="tools"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="-1" aria-label="Zoom out">&minus;</button><button type="button" data-z="x" aria-label="Close">&times;</button></div></div>`;
  document.body.appendChild(view);
  const cv = view.querySelector('canvas');
  const g = cv.getContext('2d');
  const S = 1024;
  let zoom = 0, focus = null, raf = 0, last = 0;
  const ZOOMS = [46, 26, 14]; // half-width of the map in metres

  // ---------- the paper and the land, drawn once per extent
  let base = null, baseKey = '';
  function land(ox, oz, R) {
    const key = `${ox.toFixed(1)},${oz.toFixed(1)},${R}`;
    if (key === baseKey) return base;
    baseKey = key;
    base = document.createElement('canvas');
    base.width = base.height = S;
    const b = base.getContext('2d');
    // parchment
    const grad = b.createRadialGradient(S * 0.45, S * 0.4, S * 0.1, S / 2, S / 2, S * 0.75);
    grad.addColorStop(0, '#eadbb2');
    grad.addColorStop(1, '#cdb07a');
    b.fillStyle = grad;
    b.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      b.fillStyle = `rgba(${110 + Math.random() * 40},${80 + Math.random() * 30},${40},${Math.random() * 0.05})`;
      const r = 10 + Math.random() * 60;
      b.beginPath();
      b.arc(Math.random() * S, Math.random() * S, r, 0, Math.PI * 2);
      b.fill();
    }
    // hill shading from the real heights, drawn small and smoothed up
    const N = 160, m = (2 * R) / N, step = S / N;
    const H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = heightAt(ox - R + i * m, oz - R + j * m);
    const sh = document.createElement('canvas');
    sh.width = sh.height = N;
    const sg = sh.getContext('2d');
    const img = sg.createImageData(N, N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const h = H[j * (N + 1) + i];
        const shade = (H[j * (N + 1) + i + 1] - h - (H[(j + 1) * (N + 1) + i] - h)) / m; // light from the north-west
        const k = (j * N + i) * 4;
        if (shade > 0) {
          img.data[k] = 255; img.data[k + 1] = 248; img.data[k + 2] = 225; img.data[k + 3] = Math.min(0.35, shade * 0.9) * 255;
        } else {
          img.data[k] = 90; img.data[k + 1] = 60; img.data[k + 2] = 25; img.data[k + 3] = Math.min(0.42, -shade * 1.1) * 255;
        }
      }
    sg.putImageData(img, 0, 0);
    b.imageSmoothingEnabled = true;
    b.imageSmoothingQuality = 'high';
    b.drawImage(sh, 0, 0, S, S);
    // contour lines every metre (marching squares), heavier every fifth
    const lo = Math.floor(Math.min(...H)), hi = Math.ceil(Math.max(...H));
    const at = (i, j) => H[j * (N + 1) + i];
    for (let lv = lo; lv <= hi; lv++) {
      b.strokeStyle = lv % 5 === 0 ? 'rgba(105,65,25,.62)' : 'rgba(105,65,25,.32)';
      b.lineWidth = lv % 5 === 0 ? 2 : 1.2;
      b.beginPath();
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const a = at(i, j), c = at(i + 1, j), d = at(i + 1, j + 1), e = at(i, j + 1);
          const pts = [];
          const cross = (h1, h2, x1, y1, x2, y2) => {
            if ((h1 < lv) !== (h2 < lv)) {
              const t = (lv - h1) / (h2 - h1);
              pts.push([(x1 + (x2 - x1) * t) * step, (y1 + (y2 - y1) * t) * step]);
            }
          };
          cross(a, c, i, j, i + 1, j);
          cross(c, d, i + 1, j, i + 1, j + 1);
          cross(d, e, i + 1, j + 1, i, j + 1);
          cross(e, a, i, j + 1, i, j);
          for (let k = 0; k + 1 < pts.length; k += 2) {
            b.moveTo(pts[k][0], pts[k][1]);
            b.lineTo(pts[k + 1][0], pts[k + 1][1]);
          }
        }
      b.stroke();
    }
    // heather tufts, inked
    b.strokeStyle = 'rgba(80,60,30,.35)';
    b.lineWidth = 1.2;
    for (let i = 0; i < 380; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      b.beginPath();
      b.moveTo(x - 4, y);
      b.lineTo(x - 1, y - 6);
      b.moveTo(x, y);
      b.lineTo(x + 1, y - 8);
      b.moveTo(x + 4, y);
      b.lineTo(x + 2, y - 5);
      b.stroke();
    }
    // a burnt edge
    const edge = b.createRadialGradient(S / 2, S / 2, S * 0.42, S / 2, S / 2, S * 0.74);
    edge.addColorStop(0, 'rgba(60,35,10,0)');
    edge.addColorStop(1, 'rgba(60,35,10,.55)');
    b.fillStyle = edge;
    b.fillRect(0, 0, S, S);
    return base;
  }

  function draw() {
    const P = getPlayer();
    const R = ZOOMS[zoom];
    const ox = zoom === 0 ? 0 : P.x, oz = zoom === 0 ? 0 : P.z;
    const sc = S / (2 * R);
    const X = (x) => S / 2 + (x - ox) * sc, Y = (z) => S / 2 + (z - oz) * sc;
    g.drawImage(land(ox, oz, R), 0, 0);
    g.save();
    // standing stones and boulders
    for (const s of solids) {
      const x = X(s.position.x), y = Y(s.position.z);
      if (s.kind === 'box') {
        const q = s.quaternion;
        const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
        g.save();
        g.translate(x, y);
        g.rotate(-yaw);
        g.fillStyle = '#3a2a1a';
        g.fillRect(-s.size[0] * sc, -s.size[2] * sc, s.size[0] * 2 * sc, s.size[2] * 2 * sc);
        g.restore();
      } else {
        g.fillStyle = 'rgba(70,52,32,.45)';
        g.strokeStyle = 'rgba(58,42,26,.85)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, Math.max(2.5, (s.size[0] / 0.7) * sc * 0.8), 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    // the fire
    const fx = X(fireAt.x), fy = Y(fireAt.z);
    g.fillStyle = '#b8401c';
    g.beginPath();
    g.moveTo(fx, fy - 13);
    g.quadraticCurveTo(fx + 9, fy - 2, fx, fy + 7);
    g.quadraticCurveTo(fx - 9, fy - 2, fx, fy - 13);
    g.fill();
    // the cauldron
    const cx = X(cauldronAt.x), cy = Y(cauldronAt.z);
    g.fillStyle = '#2a2a22';
    g.beginPath();
    g.arc(cx, cy, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#58c048';
    g.beginPath();
    g.arc(cx, cy, 5, 0, Math.PI * 2);
    g.fill();
    label('The three sisters', cx, cy + 24, '#2a4a1a');
    label('The fire', fx, fy + 24, '#6a2410');
    // markers
    for (const mk of getMarkers()) {
      if (!mk.at || (mk.id === 'witches' && focus !== 'witches')) continue; // the cauldron is drawn already
      const x = X(mk.at.x), y = Y(mk.at.z);
      const on = focus && focus === mk.id;
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillStyle = mk.kind === 'objective' ? '#c9962c' : '#6a88a8';
      g.strokeStyle = '#3a2414';
      g.lineWidth = 2;
      const r = on ? 11 : 8;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.strokeRect(-r, -r, r * 2, r * 2);
      g.restore();
      if (on) {
        g.strokeStyle = 'rgba(160,30,20,.8)';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x, y, 24 + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2);
        g.stroke();
      }
      label(mk.label, x, y - 20, '#3a2414');
    }
    // Macbeth
    const px = X(P.x), py = Y(P.z);
    g.save();
    g.translate(px, py);
    g.rotate((P.bearing * Math.PI) / 180);
    g.fillStyle = '#a01c10';
    g.strokeStyle = '#2a0a06';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -18);
    g.lineTo(11, 12);
    g.lineTo(0, 6);
    g.lineTo(-11, 12);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // compass rose, title and scale
    rose(S - 90, 90);
    g.font = '700 30px Cinzel, serif';
    g.fillStyle = '#3a1a0c';
    g.textAlign = 'center';
    g.fillText('The Heath near Forres', S / 2, S - 48);
    const ten = 10 * sc;
    g.strokeStyle = '#3a2414';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(48, S - 50);
    g.lineTo(48 + ten, S - 50);
    g.moveTo(48, S - 58);
    g.lineTo(48, S - 42);
    g.moveTo(48 + ten, S - 58);
    g.lineTo(48 + ten, S - 42);
    g.stroke();
    g.font = 'italic 20px "IM Fell English", serif';
    g.textAlign = 'left';
    g.fillText('ten paces of ten', 48, S - 64);
    g.restore();
  }
  function label(text, x, y, color) {
    g.font = 'italic 21px "IM Fell English", serif';
    g.textAlign = 'center';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(234,219,178,.85)';
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
  }
  function rose(x, y) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = '#3a2414';
    g.fillStyle = '#3a2414';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 44, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.beginPath();
      g.moveTo(0, -48);
      g.lineTo(8, -8);
      g.lineTo(0, 0);
      g.lineTo(-8, -8);
      g.closePath();
      i === 3 ? g.fill() : g.stroke();
    }
    g.font = '700 22px Cinzel, serif';
    g.textAlign = 'center';
    g.fillText('N', 0, -54);
    g.restore();
  }
  function loop(t) {
    if (view.hidden) return;
    if (t - last > 90) {
      last = t;
      draw();
    }
    raf = requestAnimationFrame(loop);
  }
  view.addEventListener('click', (e) => {
    const z = e.target.closest('[data-z]');
    if (e.target === view || (z && z.dataset.z === 'x')) return api.close();
    if (z) {
      zoom = Math.max(0, Math.min(ZOOMS.length - 1, zoom + Number(z.dataset.z)));
      draw();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (view.hidden) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      api.close();
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') view.querySelector('[data-z="1"]').click();
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') view.querySelector('[data-z="-1"]').click();
  });
  const api = {
    get isOpen() {
      return !view.hidden;
    },
    open(focusId = null) {
      focus = focusId;
      view.hidden = false;
      draw();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    close() {
      view.hidden = true;
      cancelAnimationFrame(raf);
    },
    toggle() {
      view.hidden ? api.open() : api.close();
    },
  };
  return api;
}
