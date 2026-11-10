// Five hand-built stages. Each theme paints a static layer once (cached by
// the renderer) and a light animated layer every frame.

import { TAU, mulberry32, rgba } from '../util.js';

const circle = (c, x, y, r) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
};

function sky(c, W, H, stops) {
  const g = c.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

function hills(c, W, yBase, amp, freq, phase, color, H) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const y = yBase - amp * (0.5 + 0.5 * Math.sin(x * freq + phase)) - amp * 0.3 * Math.sin(x * freq * 2.3 + phase * 2);
    c.lineTo(x, y);
  }
  c.lineTo(W, H);
  c.closePath();
  c.fill();
}

function glow(c, x, y, r, color, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

function pine(c, x, y, h, color) {
  c.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const w = h * (0.2 + i * 0.09);
    const top = y - h + i * h * 0.2;
    c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x + w, top + h * 0.36);
    c.lineTo(x - w, top + h * 0.36);
    c.closePath();
    c.fill();
  }
  c.fillRect(x - h * 0.04, y - h * 0.1, h * 0.08, h * 0.12);
}

function palm(c, x, y, h, lean, color) {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineCap = 'round';
  c.lineWidth = h * 0.06;
  const tx = x + lean * h * 0.3;
  const ty = y - h;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean * h * 0.05, y - h * 0.6, tx, ty);
  c.stroke();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9 + lean * 0.15;
    const len = h * (0.42 + 0.08 * Math.sin(i * 2.1));
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 + len * 0.3;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.75, ex, ey);
    c.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.4, tx, ty);
    c.fill();
    c.lineWidth = h * 0.018;
    c.stroke();
  }
}

export const THEMES = {
  // ------------------------------------------------------------ Backyard
  backyard: {
    name: 'The Backyard',
    accent: '#FFB300',
    accent2: '#2FA8FF',
    card: ['#57C1FF', '#8EE28A'],
    paint(c, W, H, hY, U) {
      const rand = mulberry32(11);
      sky(c, W, H, [[0, '#2F9BF0'], [hY / H * 0.6, '#74CBFF'], [hY / H, '#D9F4FF'], [1, '#D9F4FF']]);
      const sx = W * 0.8, sy = hY * 0.3;
      glow(c, sx, sy, U * 0.42, '#FFF6C2', 0.9);
      c.fillStyle = '#FFE45C';
      circle(c, sx, sy, U * 0.085);
      c.fillStyle = '#FFF3A6';
      circle(c, sx, sy, U * 0.066);
      hills(c, W, hY + U * 0.02, U * 0.11, 3.1 / W, 0.6, '#8FDB86', H);
      hills(c, W, hY + U * 0.05, U * 0.07, 6.3 / W, 2.2, '#6CCB6B', H);
      // tree
      const tx = W * 0.1, ty = hY + U * 0.02;
      c.fillStyle = '#7A5230';
      c.fillRect(tx - U * 0.012, ty - U * 0.16, U * 0.024, U * 0.17);
      c.fillStyle = '#3FA650';
      circle(c, tx, ty - U * 0.2, U * 0.075);
      circle(c, tx - U * 0.05, ty - U * 0.16, U * 0.055);
      circle(c, tx + U * 0.055, ty - U * 0.165, U * 0.058);
      c.fillStyle = '#58BF62';
      circle(c, tx - U * 0.02, ty - U * 0.22, U * 0.04);
      // ground
      const g = c.createLinearGradient(0, hY, 0, H);
      g.addColorStop(0, '#63CF68');
      g.addColorStop(1, '#2F9450');
      c.fillStyle = g;
      c.fillRect(0, hY + U * 0.03, W, H);
      // picket fence
      const ph = U * 0.085, pw = U * 0.03;
      for (let x = -pw; x < W + pw; x += pw * 1.35) {
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.moveTo(x, hY + U * 0.045);
        c.lineTo(x, hY + U * 0.045 - ph);
        c.lineTo(x + pw * 0.5, hY + U * 0.045 - ph - pw * 0.5);
        c.lineTo(x + pw, hY + U * 0.045 - ph);
        c.lineTo(x + pw, hY + U * 0.045);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(80,120,160,0.16)';
        c.fillRect(x + pw * 0.72, hY + U * 0.045 - ph, pw * 0.28, ph);
      }
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.fillRect(0, hY + U * 0.045 - ph * 0.62, W, ph * 0.12);
      // doghouse
      const dx = W * 0.9, dy = hY + U * 0.085, ds = U * 0.1;
      c.fillStyle = '#D9534F';
      c.fillRect(dx - ds * 0.6, dy - ds, ds * 1.2, ds);
      c.fillStyle = '#A83A37';
      c.beginPath();
      c.moveTo(dx - ds * 0.78, dy - ds * 0.95);
      c.lineTo(dx, dy - ds * 1.65);
      c.lineTo(dx + ds * 0.78, dy - ds * 0.95);
      c.closePath();
      c.fill();
      c.fillStyle = '#3B1F1E';
      c.beginPath();
      c.arc(dx, dy - ds * 0.42, ds * 0.3, Math.PI, 0);
      c.lineTo(dx + ds * 0.3, dy);
      c.lineTo(dx - ds * 0.3, dy);
      c.closePath();
      c.fill();
      // flowers + grass tufts
      for (let i = 0; i < 46; i++) {
        const x = rand() * W, y = hY + U * 0.08 + rand() * (H - hY);
        const s = U * (0.006 + rand() * 0.006);
        if (rand() < 0.4) {
          c.fillStyle = ['#FFFFFF', '#FFE45C', '#FF9EC4'][Math.floor(rand() * 3)];
          for (let p = 0; p < 5; p++) circle(c, x + Math.cos((p / 5) * TAU) * s, y + Math.sin((p / 5) * TAU) * s, s * 0.8);
          c.fillStyle = '#FFB300';
          circle(c, x, y, s * 0.7);
        } else {
          c.strokeStyle = 'rgba(30,110,60,0.5)';
          c.lineWidth = Math.max(1, s * 0.4);
          c.beginPath();
          c.moveTo(x - s, y);
          c.lineTo(x - s * 0.3, y - s * 2.2);
          c.moveTo(x, y);
          c.lineTo(x + s * 0.2, y - s * 3);
          c.moveTo(x + s, y);
          c.lineTo(x + s * 1.4, y - s * 2);
          c.stroke();
        }
      }
    },
    animate(c, { W, hY, U, t, beat }) {
      // sun rays
      const sx = W * 0.8, sy = hY * 0.3;
      c.save();
      c.translate(sx, sy);
      c.rotate(t * 0.12);
      c.fillStyle = `rgba(255,240,170,${0.22 + beat * 0.14})`;
      for (let i = 0; i < 10; i++) {
        c.rotate(TAU / 10);
        c.beginPath();
        c.moveTo(U * 0.1, -U * 0.012);
        c.lineTo(U * (0.17 + beat * 0.03), 0);
        c.lineTo(U * 0.1, U * 0.012);
        c.closePath();
        c.fill();
      }
      c.restore();
      // clouds
      c.fillStyle = 'rgba(255,255,255,0.92)';
      for (let i = 0; i < 4; i++) {
        const s = U * (0.05 + (i % 3) * 0.014);
        const span = W + s * 8;
        const x = ((i * 0.31 * span + t * (6 + i * 3)) % span) - s * 4;
        const y = hY * (0.16 + i * 0.13);
        circle(c, x, y, s);
        circle(c, x + s * 1.1, y + s * 0.2, s * 0.8);
        circle(c, x - s * 1.1, y + s * 0.25, s * 0.7);
        circle(c, x + s * 0.3, y - s * 0.5, s * 0.75);
        c.fillRect(x - s * 1.1, y + s * 0.2, s * 2.2, s * 0.76);
      }
    },
  },

  // ---------------------------------------------------------------- Moon
  moon: {
    name: 'Howling Hill',
    accent: '#8FB4FF',
    accent2: '#FFE9A8',
    card: ['#1B2A6B', '#6E7FD6'],
    paint(c, W, H, hY, U) {
      const rand = mulberry32(23);
      sky(c, W, H, [[0, '#050822'], [hY / H * 0.7, '#14235C'], [hY / H, '#34509B'], [1, '#34509B']]);
      for (let i = 0; i < 130; i++) {
        c.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.6})`;
        circle(c, rand() * W, rand() * hY, U * (0.0012 + rand() * 0.0022));
      }
      const mx = W * 0.5, my = hY * 0.42, mr = U * 0.15;
      glow(c, mx, my, mr * 3.2, '#BFD4FF', 0.5);
      c.fillStyle = '#FFF6D6';
      circle(c, mx, my, mr);
      c.fillStyle = 'rgba(214,200,160,0.55)';
      circle(c, mx - mr * 0.35, my - mr * 0.25, mr * 0.2);
      circle(c, mx + mr * 0.3, my + mr * 0.3, mr * 0.26);
      circle(c, mx + mr * 0.42, my - mr * 0.42, mr * 0.11);
      circle(c, mx - mr * 0.25, my + mr * 0.5, mr * 0.1);
      hills(c, W, hY + U * 0.03, U * 0.1, 4.2 / W, 1.3, '#1A2B66', H);
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1;
        const x = W * 0.5 + side * (W * 0.2 + rand() * W * 0.32);
        pine(c, x, hY + U * 0.06, U * (0.12 + rand() * 0.12), i % 3 ? '#0B1638' : '#101F4A');
      }
      const g = c.createLinearGradient(0, hY, 0, H);
      g.addColorStop(0, '#12235A');
      g.addColorStop(1, '#060B24');
      c.fillStyle = g;
      c.fillRect(0, hY + U * 0.05, W, H);
    },
    animate(c, { W, H, hY, U, t, beat }) {
      glow(c, W * 0.5, hY * 0.42, U * (0.36 + beat * 0.05), '#DDE8FF', 0.16 + beat * 0.12);
      for (let i = 0; i < 14; i++) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + (i % 5) * 0.2) + i * 1.7));
        c.fillStyle = `rgba(255,255,255,${a})`;
        const x = ((i * 0.618 + 0.13) % 1) * W, y = ((i * 0.381 + 0.07) % 1) * hY * 0.9;
        circle(c, x, y, U * 0.003);
      }
      for (let i = 0; i < 12; i++) {
        const x = ((i * 0.27 + 0.05) % 1) * W + Math.sin(t * 0.5 + i) * U * 0.03;
        const y = hY + U * 0.08 + ((i * 0.43) % 1) * (H - hY) * 0.8 + Math.cos(t * 0.7 + i * 2) * U * 0.02;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i * 2.4));
        glow(c, x, y, U * 0.02, '#F4FF9A', a * 0.9);
      }
    },
  },

  // ---------------------------------------------------------------- City
  city: {
    name: 'Chew Toy City',
    accent: '#FF4FA3',
    accent2: '#52E5FF',
    card: ['#3A0F6B', '#FF4F9A'],
    paint(c, W, H, hY, U) {
      const rand = mulberry32(37);
      sky(c, W, H, [[0, '#0E0124'], [hY / H * 0.55, '#3C0D6B'], [hY / H * 0.9, '#D43F8D'], [hY / H, '#FF9A6B'], [1, '#FF9A6B']]);
      for (let i = 0; i < 60; i++) {
        c.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.5})`;
        circle(c, rand() * W, rand() * hY * 0.6, U * 0.002);
      }
      // striped retro sun
      const sx = W * 0.5, sy = hY * 0.68, sr = U * 0.24;
      glow(c, sx, sy, sr * 2, '#FF5FA8', 0.45);
      c.save();
      c.beginPath();
      c.arc(sx, sy, sr, 0, TAU);
      c.clip();
      const sg = c.createLinearGradient(0, sy - sr, 0, sy + sr);
      sg.addColorStop(0, '#FFE66B');
      sg.addColorStop(0.55, '#FF7A59');
      sg.addColorStop(1, '#FF2E93');
      c.fillStyle = sg;
      c.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 6; i++) {
        const y = sy + sr * (0.08 + i * 0.16);
        c.fillRect(sx - sr, y, sr * 2, sr * (0.03 + i * 0.016));
      }
      c.restore();
      // skyline
      for (let layer = 0; layer < 2; layer++) {
        let x = -U * 0.02;
        while (x < W) {
          const w = U * (0.05 + rand() * 0.07);
          const h = U * (0.06 + rand() * (layer ? 0.16 : 0.26));
          const y = hY + U * 0.03 - h;
          c.fillStyle = layer ? '#12052C' : '#2A0B52';
          c.fillRect(x, y, w, h + 4);
          if (rand() < 0.3) c.fillRect(x + w * 0.45, y - h * 0.18, w * 0.1, h * 0.2);
          const cols = Math.max(2, Math.floor(w / (U * 0.016)));
          const rows = Math.floor(h / (U * 0.022));
          for (let r = 0; r < rows; r++) {
            for (let k = 0; k < cols; k++) {
              if (rand() < (layer ? 0.3 : 0.16)) {
                c.fillStyle = rand() < 0.5 ? 'rgba(255,216,107,0.85)' : 'rgba(92,225,255,0.8)';
                c.fillRect(x + (k + 0.3) * (w / cols), y + (r + 0.35) * (h / Math.max(1, rows)), (w / cols) * 0.42, U * 0.009);
              }
            }
          }
          x += w + U * 0.004;
        }
      }
      const g = c.createLinearGradient(0, hY, 0, H);
      g.addColorStop(0, '#2B0A4F');
      g.addColorStop(1, '#0B021C');
      c.fillStyle = g;
      c.fillRect(0, hY + U * 0.03, W, H);
      // neon grid: fixed radial lines
      c.strokeStyle = 'rgba(255,79,163,0.4)';
      c.lineWidth = Math.max(1, U * 0.0025);
      c.beginPath();
      for (let i = -14; i <= 14; i++) {
        c.moveTo(W * 0.5 + i * U * 0.035, hY + U * 0.03);
        c.lineTo(W * 0.5 + i * U * 0.6, H);
      }
      c.stroke();
    },
    animate(c, { W, H, hY, U, t, beat }) {
      const top = hY + U * 0.03;
      c.strokeStyle = `rgba(255,79,163,${0.3 + beat * 0.25})`;
      c.lineWidth = Math.max(1, U * 0.0025);
      c.beginPath();
      for (let i = 0; i < 9; i++) {
        const p = ((i + (t * 0.5) % 1) / 9) ** 2.2;
        const y = top + p * (H - top);
        c.moveTo(0, y);
        c.lineTo(W, y);
      }
      c.stroke();
      glow(c, W * 0.5, hY * 0.68, U * (0.42 + beat * 0.06), '#FF7AB8', 0.1 + beat * 0.14);
    },
  },

  // --------------------------------------------------------------- Beach
  beach: {
    name: 'Fetch Beach',
    accent: '#FF7A45',
    accent2: '#35D6C4',
    card: ['#FF6B6B', '#FFC55C'],
    paint(c, W, H, hY, U) {
      const rand = mulberry32(51);
      sky(c, W, H, [[0, '#2B1A66'], [hY / H * 0.45, '#B8457F'], [hY / H * 0.8, '#FF8552'], [hY / H, '#FFD27A'], [1, '#FFD27A']]);
      const sx = W * 0.5, sy = hY + U * 0.01, sr = U * 0.13;
      glow(c, sx, sy, sr * 3, '#FFE9A0', 0.75);
      c.fillStyle = '#FFF1B8';
      c.beginPath();
      c.arc(sx, sy, sr, Math.PI, 0);
      c.fill();
      // long clouds
      for (let i = 0; i < 7; i++) {
        const y = hY * (0.2 + rand() * 0.6), w = U * (0.2 + rand() * 0.35), x = rand() * W;
        c.fillStyle = `rgba(255,${170 + Math.floor(rand() * 60)},${150 + Math.floor(rand() * 50)},0.35)`;
        c.beginPath();
        c.ellipse(x, y, w, U * 0.012, 0, 0, TAU);
        c.fill();
      }
      // sea
      const seaH = U * 0.16;
      const g = c.createLinearGradient(0, hY, 0, hY + seaH);
      g.addColorStop(0, '#FFB26B');
      g.addColorStop(0.25, '#E0677A');
      g.addColorStop(1, '#27578F');
      c.fillStyle = g;
      c.fillRect(0, hY + U * 0.01, W, seaH);
      // sand
      const sg = c.createLinearGradient(0, hY + seaH, 0, H);
      sg.addColorStop(0, '#F6D39A');
      sg.addColorStop(1, '#C98D5E');
      c.fillStyle = sg;
      c.beginPath();
      c.moveTo(0, H);
      c.lineTo(0, hY + seaH);
      c.quadraticCurveTo(W * 0.5, hY + seaH - U * 0.05, W, hY + seaH);
      c.lineTo(W, H);
      c.closePath();
      c.fill();
      for (let i = 0; i < 80; i++) {
        c.fillStyle = `rgba(150,95,60,${0.1 + rand() * 0.14})`;
        circle(c, rand() * W, hY + seaH + rand() * (H - hY - seaH), U * (0.002 + rand() * 0.004));
      }
      palm(c, -U * 0.02, hY + seaH + U * 0.03, U * 0.42, 1, '#3A1B4D');
      palm(c, W + U * 0.02, hY + seaH + U * 0.05, U * 0.48, -1, '#2E1640');
      // beach ball
      const bx = W * 0.1, by = hY + seaH + U * 0.12, br = U * 0.03;
      const cols = ['#FF5F6D', '#FFFFFF', '#3FD8FF', '#FFD23F', '#FFFFFF', '#7CE38B'];
      cols.forEach((col, i) => {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(bx, by);
        c.arc(bx, by, br, (i / 6) * TAU, ((i + 1) / 6) * TAU);
        c.closePath();
        c.fill();
      });
    },
    animate(c, { W, hY, U, t, beat }) {
      c.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const y = hY + U * (0.025 + (i / 12) * 0.125);
        const w = U * (0.03 + (i / 12) * 0.09) * (0.7 + 0.3 * Math.sin(t * 1.4 + i * 1.9));
        const x = W * 0.5 + Math.sin(t * 0.6 + i * 2.4) * U * (0.02 + i * 0.012);
        c.strokeStyle = `rgba(255,236,170,${0.55 - i * 0.03 + beat * 0.15})`;
        c.lineWidth = Math.max(1, U * 0.004);
        c.beginPath();
        c.moveTo(x - w, y);
        c.lineTo(x + w, y);
        c.stroke();
      }
      // gulls
      c.strokeStyle = 'rgba(60,30,80,0.7)';
      c.lineWidth = Math.max(1, U * 0.003);
      for (let i = 0; i < 3; i++) {
        const x = ((t * 0.02 + i * 0.37) % 1.2) * W - W * 0.1;
        const y = hY * (0.28 + i * 0.1) + Math.sin(t + i) * U * 0.01;
        const s = U * 0.014, flap = Math.sin(t * 6 + i) * s * 0.4;
        c.beginPath();
        c.moveTo(x - s, y - flap);
        c.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y);
        c.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - flap);
        c.stroke();
      }
    },
  },

  // --------------------------------------------------------------- Space
  space: {
    name: 'Zoomies Station',
    accent: '#A56BFF',
    accent2: '#5CFFC9',
    card: ['#1A0B4A', '#8E4BFF'],
    paint(c, W, H, hY, U) {
      const rand = mulberry32(77);
      sky(c, W, H, [[0, '#04010D'], [hY / H * 0.6, '#150A3A'], [hY / H, '#3A1670'], [1, '#3A1670']]);
      const blobs = [['#FF4FA3', 0.2, 0.3, 0.5], ['#3FD8FF', 0.75, 0.2, 0.45], ['#8E4BFF', 0.5, 0.6, 0.6], ['#5CFFC9', 0.9, 0.7, 0.3]];
      for (const [col, px, py, r] of blobs) glow(c, W * px, hY * py, U * r, col, 0.2);
      for (let i = 0; i < 220; i++) {
        const tint = rand();
        c.fillStyle = tint < 0.15 ? 'rgba(160,220,255,0.9)' : tint < 0.25 ? 'rgba(255,190,220,0.9)' : `rgba(255,255,255,${0.25 + rand() * 0.7})`;
        circle(c, rand() * W, rand() * hY * 1.02, U * (0.001 + rand() * 0.0026));
      }
      // ringed planet
      const px = W * 0.2, py = hY * 0.36, pr = U * 0.085;
      glow(c, px, py, pr * 2.4, '#FFB86B', 0.25);
      c.strokeStyle = 'rgba(255,224,170,0.75)';
      c.lineWidth = pr * 0.14;
      c.beginPath();
      c.ellipse(px, py, pr * 1.9, pr * 0.5, -0.35, Math.PI, TAU);
      c.stroke();
      const pg = c.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
      pg.addColorStop(0, '#FFC978');
      pg.addColorStop(0.5, '#F0736A');
      pg.addColorStop(1, '#7A2E8E');
      c.fillStyle = pg;
      circle(c, px, py, pr);
      c.beginPath();
      c.ellipse(px, py, pr * 1.9, pr * 0.5, -0.35, 0, Math.PI);
      c.stroke();
      // small moon
      c.fillStyle = '#C9D4FF';
      circle(c, W * 0.84, hY * 0.22, U * 0.03);
      c.fillStyle = 'rgba(120,130,190,0.6)';
      circle(c, W * 0.84 - U * 0.008, hY * 0.22 - U * 0.006, U * 0.008);
      circle(c, W * 0.84 + U * 0.012, hY * 0.22 + U * 0.01, U * 0.006);
      // lunar ground
      const g = c.createLinearGradient(0, hY, 0, H);
      g.addColorStop(0, '#6F6BA8');
      g.addColorStop(1, '#221C4A');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, H);
      c.lineTo(0, hY + U * 0.07);
      c.quadraticCurveTo(W * 0.5, hY - U * 0.02, W, hY + U * 0.07);
      c.lineTo(W, H);
      c.closePath();
      c.fill();
      for (let i = 0; i < 16; i++) {
        const x = rand() * W, y = hY + U * 0.1 + rand() * (H - hY - U * 0.1), r = U * (0.012 + rand() * 0.03);
        c.fillStyle = 'rgba(25,18,60,0.38)';
        c.beginPath();
        c.ellipse(x, y, r, r * 0.36, 0, 0, TAU);
        c.fill();
        c.strokeStyle = 'rgba(190,185,240,0.3)';
        c.lineWidth = Math.max(1, U * 0.002);
        c.beginPath();
        c.ellipse(x, y + r * 0.06, r, r * 0.36, 0, 0, Math.PI);
        c.stroke();
      }
    },
    animate(c, { W, hY, U, t, beat, energy }) {
      // warp streaks from the vanishing point
      const cx = W * 0.5, cy = hY * 0.55;
      c.lineCap = 'round';
      const speed = 0.25 + energy * 0.5;
      for (let i = 0; i < 36; i++) {
        const a = (i * 2.399) % TAU;
        const p = ((i * 0.137 + t * speed * (0.6 + (i % 5) * 0.2)) % 1);
        const r0 = p * p * W * 0.75 + U * 0.03;
        const r1 = r0 + p * U * (0.04 + energy * 0.06);
        const y0 = cy + Math.sin(a) * r0 * 0.6;
        if (y0 > hY) continue;
        c.strokeStyle = `rgba(200,220,255,${p * 0.7})`;
        c.lineWidth = Math.max(1, U * 0.003 * p);
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * r0, y0);
        c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.6);
        c.stroke();
      }
      glow(c, cx, cy, U * (0.3 + beat * 0.08), '#A56BFF', 0.08 + beat * 0.12);
    },
  },
};
