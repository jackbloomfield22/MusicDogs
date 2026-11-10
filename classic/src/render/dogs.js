// The band. Every dog is drawn procedurally so it can bob, blink, bark and
// howl in time with the music. All coordinates are in "head radius" units.

import { TAU, clamp, lerp } from '../util.js';

export const LANE_COLORS = ['#FF8A3D', '#FFD23F', '#3FD8FF', '#FF5FA8'];
export const LANE_COLORS_DARK = ['#B94A12', '#B88A00', '#0E86B8', '#B81E66'];

export const BAND = [
  {
    name: 'Biscuit', breed: 'corgi', role: 'Drums', pitch: 1.25,
    fur: '#F2A03D', dark: '#C9741F', light: '#FFF6E6', earIn: '#F9C4A4', eye: '#2B1D1A', ears: 'point', tail: 'nub',
  },
  {
    name: 'Waffles', breed: 'pug', role: 'Bass', pitch: 0.85,
    fur: '#EDCB94', dark: '#40322D', light: '#F8E4C0', earIn: '#40322D', eye: '#1F1614', ears: 'fold', tail: 'curl',
  },
  {
    name: 'Luna', breed: 'husky', role: 'Keys', pitch: 1.05,
    fur: '#7E8EAA', dark: '#56637E', light: '#FFFFFF', earIn: '#F2C1C8', eye: '#1D2233', iris: '#4FC3FF', ears: 'point', tail: 'fluff',
  },
  {
    name: 'Domino', breed: 'dalmatian', role: 'Guitar', pitch: 1.45,
    fur: '#FBFBFD', dark: '#2A2A33', light: '#FFFFFF', earIn: '#2A2A33', eye: '#1E1E26', ears: 'flop', tail: 'thin',
  },
];

/** Animation state for one dog. */
export class DogActor {
  constructor(index) {
    this.index = index;
    this.def = BAND[index];
    this.pop = 0; // hit squash impulse
    this.mouth = 0; // 0..1 open
    this.happy = 0; // seconds of happy eyes remaining
    this.sad = 0;
    this.blink = 2 + index * 0.7;
    this.blinking = 0;
    this.howl = 0; // 0..1 blend
    this.howlTarget = 0;
    this.shades = 0; // sunglasses blend
    this.hop = 0;
    this.hopV = 0;
    this.wag = Math.random() * TAU;
    this.wagSpeed = 6;
  }

  react(kind) {
    if (kind === 'perfect' || kind === 'great') {
      this.pop = 1;
      this.mouth = 1;
      this.happy = kind === 'perfect' ? 0.45 : 0.25;
      this.sad = 0;
      this.wagSpeed = 16;
    } else if (kind === 'good') {
      this.pop = 0.6;
      this.mouth = 0.6;
      this.sad = 0;
    } else if (kind === 'miss') {
      this.sad = 0.7;
      this.happy = 0;
      this.pop = -0.6;
    } else if (kind === 'bark') {
      this.mouth = 1;
      this.pop = 0.8;
      this.hopV = -3.2;
    } else if (kind === 'cheer') {
      this.hopV = -4.2;
      this.happy = 1.2;
      this.mouth = 0.8;
    }
  }

  update(dt) {
    this.pop = lerp(this.pop, 0, 1 - Math.exp(-dt * 11));
    this.mouth = Math.max(0, this.mouth - dt * 5);
    this.happy = Math.max(0, this.happy - dt);
    this.sad = Math.max(0, this.sad - dt);
    this.howl = lerp(this.howl, this.howlTarget, 1 - Math.exp(-dt * 6));
    this.shades = lerp(this.shades, this.howlTarget, 1 - Math.exp(-dt * 8));
    this.wagSpeed = lerp(this.wagSpeed, 6, 1 - Math.exp(-dt * 1.5));
    this.wag += dt * this.wagSpeed;
    this.blink -= dt;
    if (this.blink <= 0) {
      this.blinking = 0.12;
      this.blink = 2 + Math.random() * 3.5;
    }
    this.blinking = Math.max(0, this.blinking - dt);
    // hop physics (units: head radii)
    if (this.hop < 0 || this.hopV !== 0) {
      this.hopV += dt * 22;
      this.hop += this.hopV * dt;
      if (this.hop >= 0) {
        this.hop = 0;
        this.hopV = 0;
      }
    }
  }
}

const headPath = (c) => {
  c.beginPath();
  c.moveTo(0, -0.92);
  c.bezierCurveTo(0.62, -0.95, 1.03, -0.5, 1.0, 0.05);
  c.bezierCurveTo(0.98, 0.62, 0.55, 0.9, 0, 0.9);
  c.bezierCurveTo(-0.55, 0.9, -0.98, 0.62, -1.0, 0.05);
  c.bezierCurveTo(-1.03, -0.5, -0.62, -0.95, 0, -0.92);
  c.closePath();
};

function ear(c, def, side, wiggle) {
  c.save();
  c.scale(side, 1);
  if (def.ears === 'point') {
    c.translate(-0.6, -0.62);
    c.rotate(wiggle * 0.5 + (def.breed === 'husky' ? 0.12 : 0));
    c.translate(0.6, 0.62);
    const big = def.breed === 'corgi' ? 1 : 0.86;
    const tipX = -0.86, tipY = -0.62 - 0.92 * big;
    c.beginPath();
    c.moveTo(-0.99, -0.15);
    c.quadraticCurveTo(-1.18, -1.0, tipX, tipY);
    c.quadraticCurveTo(-0.4, -1.28 * big, -0.12, -0.78);
    c.closePath();
    c.fillStyle = def.breed === 'husky' ? def.dark : def.fur;
    c.fill();
    c.strokeStyle = def.dark;
    c.lineWidth = 0.05;
    c.stroke();
    // inner ear
    c.beginPath();
    c.moveTo(-0.86, -0.42);
    c.quadraticCurveTo(-0.98, -0.98, tipX + 0.03, tipY + 0.24);
    c.quadraticCurveTo(-0.52, -1.1 * big, -0.36, -0.72);
    c.closePath();
    c.fillStyle = def.earIn;
    c.fill();
  } else if (def.ears === 'flop') {
    c.translate(-0.68, -0.72);
    c.rotate(wiggle * 0.9);
    c.translate(0.68, 0.72);
    c.beginPath();
    c.moveTo(-0.5, -0.86);
    c.bezierCurveTo(-1.3, -1.0, -1.55, -0.1, -1.32, 0.5);
    c.bezierCurveTo(-1.18, 0.82, -0.82, 0.62, -0.84, 0.15);
    c.bezierCurveTo(-0.86, -0.25, -0.8, -0.45, -0.6, -0.6);
    c.closePath();
    c.fillStyle = def.dark;
    c.fill();
  } else {
    // pug: small folded button ears
    c.translate(-0.7, -0.7);
    c.rotate(wiggle * 0.7);
    c.translate(0.7, 0.7);
    c.beginPath();
    c.moveTo(-0.5, -0.9);
    c.quadraticCurveTo(-1.18, -1.0, -1.2, -0.28);
    c.quadraticCurveTo(-0.98, -0.5, -0.72, -0.6);
    c.closePath();
    c.fillStyle = def.dark;
    c.fill();
  }
  c.restore();
}

function markings(c, def) {
  c.save();
  headPath(c);
  c.clip();
  if (def.breed === 'corgi') {
    c.fillStyle = def.light;
    c.beginPath();
    c.moveTo(-0.09, -1);
    c.bezierCurveTo(-0.13, -0.45, -0.3, -0.1, -0.66, 0.2);
    c.bezierCurveTo(-0.95, 0.5, -0.5, 1.0, 0, 1.0);
    c.bezierCurveTo(0.5, 1.0, 0.95, 0.5, 0.66, 0.2);
    c.bezierCurveTo(0.3, -0.1, 0.13, -0.45, 0.09, -1);
    c.closePath();
    c.fill();
  } else if (def.breed === 'husky') {
    c.fillStyle = def.light;
    c.beginPath();
    c.moveTo(0, -0.3);
    c.bezierCurveTo(-0.12, -0.7, -0.66, -0.66, -0.82, -0.22);
    c.bezierCurveTo(-1.0, 0.3, -1.0, 0.7, -0.5, 1.0);
    c.lineTo(0.5, 1.0);
    c.bezierCurveTo(1.0, 0.7, 1.0, 0.3, 0.82, -0.22);
    c.bezierCurveTo(0.66, -0.66, 0.12, -0.7, 0, -0.3);
    c.closePath();
    c.fill();
    // darker cap highlight
    c.fillStyle = def.dark;
    c.beginPath();
    c.moveTo(-0.5, -1);
    c.quadraticCurveTo(0, -0.6, 0.5, -1);
    c.closePath();
    c.fill();
  } else if (def.breed === 'pug') {
    c.fillStyle = def.dark;
    c.beginPath();
    c.ellipse(0, 0.36, 0.56, 0.46, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(64,50,45,0.35)';
    c.lineWidth = 0.045;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-0.2, -0.58);
    c.quadraticCurveTo(0, -0.66, 0.2, -0.58);
    c.moveTo(-0.13, -0.46);
    c.quadraticCurveTo(0, -0.52, 0.13, -0.46);
    c.stroke();
  } else if (def.breed === 'dalmatian') {
    c.fillStyle = def.dark;
    const spots = [
      [-0.6, -0.52, 0.2, 0.15, 0.4], [0.2, -0.78, 0.13, 0.1, 0], [-0.78, 0.28, 0.1, 0.14, 0.2],
      [0.74, 0.5, 0.13, 0.1, -0.3], [-0.2, -0.62, 0.07, 0.06, 0], [0.82, -0.12, 0.08, 0.1, 0],
    ];
    for (const [x, y, rx, ry, rot] of spots) {
      c.beginPath();
      c.ellipse(x, y, rx, ry, rot, 0, TAU);
      c.fill();
    }
    c.beginPath();
    c.ellipse(0.42, -0.12, 0.28, 0.31, 0.2, 0, TAU);
    c.fill();
  }
  c.restore();
}

function eyes(c, def, st) {
  const big = def.breed === 'pug' ? 1.18 : 1;
  const ex = def.breed === 'pug' ? 0.44 : 0.4;
  const ey = -0.1;
  const onDarkPatch = def.breed === 'dalmatian';
  for (const side of [-1, 1]) {
    const x = ex * side;
    c.lineCap = 'round';
    if (st.howl > 0.5 || st.happy > 0) {
      c.strokeStyle = onDarkPatch && side === 1 ? '#FFFFFF' : def.eye;
      c.lineWidth = 0.075;
      c.beginPath();
      c.arc(x, ey + 0.07, 0.13 * big, Math.PI * 1.12, Math.PI * 1.88);
      c.stroke();
      continue;
    }
    if (st.blinking > 0) {
      c.strokeStyle = onDarkPatch && side === 1 ? '#FFFFFF' : def.eye;
      c.lineWidth = 0.07;
      c.beginPath();
      c.moveTo(x - 0.12, ey + 0.02);
      c.quadraticCurveTo(x, ey + 0.08, x + 0.12, ey + 0.02);
      c.stroke();
      continue;
    }
    if (onDarkPatch && side === 1) {
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      c.ellipse(x, ey, 0.165, 0.185, 0, 0, TAU);
      c.fill();
    }
    if (def.iris) {
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      c.ellipse(x, ey, 0.16, 0.17, 0, 0, TAU);
      c.fill();
      c.fillStyle = def.iris;
      c.beginPath();
      c.ellipse(x, ey, 0.125, 0.14, 0, 0, TAU);
      c.fill();
      c.fillStyle = def.eye;
      c.beginPath();
      c.ellipse(x, ey, 0.07, 0.085, 0, 0, TAU);
      c.fill();
      c.strokeStyle = def.eye;
      c.lineWidth = 0.035;
      c.beginPath();
      c.ellipse(x, ey, 0.16, 0.17, 0, 0, TAU);
      c.stroke();
    } else {
      c.fillStyle = def.eye;
      c.beginPath();
      c.ellipse(x, ey, 0.13 * big, 0.155 * big, 0, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(x - 0.045, ey - 0.055, 0.05 * big, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(x + 0.05, ey + 0.055, 0.024 * big, 0, TAU);
    c.fill();
    if (st.sad > 0) {
      c.strokeStyle = def.breed === 'pug' || (onDarkPatch && side === 1) ? 'rgba(255,255,255,0.8)' : def.eye;
      c.lineWidth = 0.055;
      c.beginPath();
      c.moveTo(x + side * 0.17, ey - 0.25);
      c.lineTo(x - side * 0.13, ey - 0.36);
      c.stroke();
    }
  }
}

function face(c, def, st) {
  const mouthOpen = clamp(Math.max(st.mouth, st.howl), 0, 1);
  const pug = def.breed === 'pug';
  // muzzle
  if (!pug) {
    c.fillStyle = def.light;
    c.beginPath();
    c.ellipse(0, 0.38, 0.43, 0.33, 0, 0, TAU);
    c.fill();
    if (def.breed === 'dalmatian' || def.breed === 'husky') {
      c.strokeStyle = 'rgba(40,50,80,0.12)';
      c.lineWidth = 0.035;
      c.stroke();
    }
  }
  const ink = pug ? '#120D0C' : '#3A2A26';
  // open mouth
  if (st.howl > 0.5) {
    c.fillStyle = '#5A1F2A';
    c.beginPath();
    c.ellipse(0, 0.55, 0.13, 0.12 + 0.07 * st.howl, 0, 0, TAU);
    c.fill();
  } else if (mouthOpen > 0.05) {
    c.fillStyle = '#6B2330';
    c.beginPath();
    c.moveTo(-0.24, 0.43);
    c.quadraticCurveTo(0, 0.44 + 0.62 * mouthOpen, 0.24, 0.43);
    c.quadraticCurveTo(0, 0.4, -0.24, 0.43);
    c.fill();
    c.fillStyle = '#FF8FA3';
    c.beginPath();
    c.ellipse(0, 0.47 + 0.14 * mouthOpen, 0.11, 0.05 + 0.11 * mouthOpen, 0, 0, TAU);
    c.fill();
  }
  // mouth line
  c.strokeStyle = pug ? '#0C0808' : ink;
  c.lineWidth = 0.042;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0.3);
  c.lineTo(0, 0.4);
  if (st.howl <= 0.5) {
    c.moveTo(-0.26, 0.4);
    c.quadraticCurveTo(-0.13, 0.53, 0, 0.4);
    c.quadraticCurveTo(0.13, 0.53, 0.26, 0.4);
  }
  c.stroke();
  // nose
  c.fillStyle = pug ? '#0C0808' : ink;
  c.beginPath();
  c.moveTo(-0.13, 0.13);
  c.quadraticCurveTo(0, 0.06, 0.13, 0.13);
  c.quadraticCurveTo(0.15, 0.25, 0, 0.32);
  c.quadraticCurveTo(-0.15, 0.25, -0.13, 0.13);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath();
  c.ellipse(-0.04, 0.15, 0.045, 0.022, -0.2, 0, TAU);
  c.fill();
  // blush
  c.fillStyle = 'rgba(255,110,140,0.28)';
  c.beginPath();
  c.ellipse(-0.66, 0.24, 0.13, 0.08, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(0.66, 0.24, 0.13, 0.08, 0, 0, TAU);
  c.fill();
}

function accessories(c, def, st, color) {
  if (def.breed === 'husky') {
    // headphones
    c.strokeStyle = '#23263A';
    c.lineWidth = 0.13;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, -0.08, 1.02, Math.PI * 1.13, Math.PI * 1.87);
    c.stroke();
    for (const s of [-1, 1]) {
      c.fillStyle = '#23263A';
      roundRect(c, s * 1.0 - 0.15, -0.36, 0.3, 0.62, 0.13);
      c.fill();
      c.fillStyle = color;
      roundRect(c, s * 1.06 - 0.07, -0.26, 0.14, 0.42, 0.07);
      c.fill();
    }
  } else if (def.breed === 'pug') {
    // beanie
    c.fillStyle = '#E8475F';
    c.beginPath();
    c.moveTo(-0.72, -0.62);
    c.bezierCurveTo(-0.6, -1.32, 0.6, -1.32, 0.72, -0.62);
    c.closePath();
    c.fill();
    c.fillStyle = '#FFFFFF';
    roundRect(c, -0.78, -0.76, 1.56, 0.22, 0.11);
    c.fill();
    c.beginPath();
    c.arc(0, -1.2, 0.14, 0, TAU);
    c.fill();
  } else if (def.breed === 'dalmatian') {
    // bow on the left ear
    c.save();
    c.translate(-0.78, -0.74);
    c.rotate(-0.5);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-0.34, -0.3, -0.34, 0);
    c.quadraticCurveTo(-0.34, 0.3, 0, 0);
    c.quadraticCurveTo(0.34, -0.3, 0.34, 0);
    c.quadraticCurveTo(0.34, 0.3, 0, 0);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(0, 0, 0.075, 0, TAU);
    c.fill();
    c.restore();
  }
  if (st.shades > 0.02) {
    c.save();
    c.globalAlpha *= clamp(st.shades * 1.4, 0, 1);
    c.translate(0, -0.1 - (1 - st.shades) * 0.9);
    c.fillStyle = '#14141F';
    roundRect(c, -0.7, -0.17, 0.6, 0.36, 0.12);
    c.fill();
    roundRect(c, 0.1, -0.17, 0.6, 0.36, 0.12);
    c.fill();
    c.fillRect(-0.12, -0.12, 0.24, 0.08);
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 0.05;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-0.58, 0.06);
    c.lineTo(-0.42, -0.08);
    c.moveTo(0.22, 0.06);
    c.lineTo(0.38, -0.08);
    c.stroke();
    c.restore();
  }
}

export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * Body + tail (drawn behind the podium).
 * @param beat  bob amount 0..1 (1 right on the beat)
 */
export function drawDogBody(c, actor, x, y, r, beat) {
  const def = actor.def;
  c.save();
  c.translate(x, y + actor.hop * r);
  c.scale(r, r);
  // tail
  const wag = Math.sin(actor.wag) * 0.3;
  c.save();
  c.translate(0.55, 1.75);
  c.rotate(-0.5 + wag);
  c.lineCap = 'round';
  if (def.tail === 'fluff') {
    c.strokeStyle = def.dark;
    c.lineWidth = 0.34;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(0.7, -0.2, 0.62, -0.85);
    c.stroke();
    c.strokeStyle = def.light;
    c.lineWidth = 0.2;
    c.beginPath();
    c.moveTo(0.63, -0.6);
    c.lineTo(0.62, -0.85);
    c.stroke();
  } else if (def.tail === 'thin') {
    c.strokeStyle = def.fur;
    c.lineWidth = 0.13;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(0.6, -0.3, 0.7, -0.95);
    c.stroke();
    c.strokeStyle = 'rgba(40,40,60,0.25)';
    c.lineWidth = 0.03;
    c.stroke();
  } else if (def.tail === 'curl') {
    c.strokeStyle = def.fur;
    c.lineWidth = 0.17;
    c.beginPath();
    c.arc(0.42, -0.2, 0.26, Math.PI * 0.8, Math.PI * 2.6);
    c.stroke();
  } else {
    c.fillStyle = def.fur;
    c.beginPath();
    c.ellipse(0.4, -0.2, 0.3, 0.22, -0.5, 0, TAU);
    c.fill();
  }
  c.restore();
  // torso
  const squash = 1 + beat * 0.03;
  c.scale(squash, 1);
  c.fillStyle = def.breed === 'husky' ? def.fur : def.fur;
  c.beginPath();
  c.moveTo(-0.5, 0.6);
  c.bezierCurveTo(-0.85, 1.1, -0.8, 1.9, -0.66, 2.2);
  c.lineTo(0.66, 2.2);
  c.bezierCurveTo(0.8, 1.9, 0.85, 1.1, 0.5, 0.6);
  c.closePath();
  c.fill();
  if (def.breed === 'dalmatian') {
    c.strokeStyle = 'rgba(40,40,70,0.18)';
    c.lineWidth = 0.04;
    c.stroke();
    c.fillStyle = def.dark;
    c.beginPath();
    c.ellipse(-0.42, 1.3, 0.1, 0.13, 0.3, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(0.46, 1.55, 0.12, 0.09, 0, 0, TAU);
    c.fill();
  } else {
    c.fillStyle = def.light;
    c.beginPath();
    c.ellipse(0, 1.5, 0.38, 0.62, 0, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** Paws + head (drawn in front of the podium). pawY is in head radii. */
export function drawDogHead(c, actor, x, y, r, beat, color, pawY = 1.42) {
  const def = actor.def;
  const st = actor;
  c.save();
  c.translate(x, y + actor.hop * r);
  c.scale(r, r);

  // paws resting on the podium, tapping on alternate beats
  for (const side of [-1, 1]) {
    const tap = side === (actor.index % 2 ? 1 : -1) ? beat : 0;
    c.fillStyle = def.breed === 'pug' ? def.fur : def.light;
    c.beginPath();
    c.ellipse(side * 0.42, pawY - tap * 0.12, 0.21, 0.15, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(60,40,40,0.28)';
    c.lineWidth = 0.035;
    c.stroke();
    c.beginPath();
    c.moveTo(side * 0.42 - 0.07, pawY - tap * 0.12 - 0.02);
    c.lineTo(side * 0.42 - 0.07, pawY - tap * 0.12 + 0.1);
    c.moveTo(side * 0.42 + 0.07, pawY - tap * 0.12 - 0.02);
    c.lineTo(side * 0.42 + 0.07, pawY - tap * 0.12 + 0.1);
    c.stroke();
  }

  // collar
  c.strokeStyle = color;
  c.lineWidth = 0.15;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-0.46, 0.8);
  c.quadraticCurveTo(0, 1.04, 0.46, 0.8);
  c.stroke();
  c.fillStyle = '#FFD86B';
  c.beginPath();
  c.arc(0, 1.02, 0.1, 0, TAU);
  c.fill();

  // head: bob, tilt, squash & stretch
  const bob = beat * 0.07 - st.pop * 0.06;
  const tilt = Math.sin(actor.wag * 0.25 + actor.index) * 0.035 - st.howl * 0.22 + (st.sad > 0 ? 0.08 : 0);
  c.translate(0, bob + (st.sad > 0 ? 0.06 : 0) - st.howl * 0.12);
  c.rotate(tilt);
  const sq = 1 + st.pop * 0.07 + beat * 0.015;
  c.scale(sq, 2 - sq);

  const wiggle = -beat * 0.16 - st.pop * 0.2 + (st.sad > 0 ? -0.25 : 0);
  ear(c, def, -1, wiggle);
  ear(c, def, 1, wiggle);
  headPath(c);
  c.fillStyle = def.fur;
  c.fill();
  markings(c, def);
  headPath(c);
  c.strokeStyle = def.breed === 'dalmatian' ? 'rgba(40,40,70,0.22)' : def.breed === 'husky' ? def.dark : def.dark === '#40322D' ? '#C9A46C' : def.dark;
  c.lineWidth = 0.05;
  c.stroke();
  face(c, def, st);
  eyes(c, def, st);
  accessories(c, def, st, color);
  c.restore();
}

/** Simple line icons for each band member's instrument (unit box ~1x1). */
export function drawInstrumentIcon(c, index, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 0.09;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (index === 0) {
    // drum
    c.beginPath();
    c.ellipse(0, -0.12, 0.42, 0.15, 0, 0, TAU);
    c.stroke();
    c.beginPath();
    c.moveTo(-0.42, -0.12);
    c.lineTo(-0.42, 0.22);
    c.ellipse(0, 0.22, 0.42, 0.15, 0, Math.PI, 0, true);
    c.lineTo(0.42, -0.12);
    c.stroke();
    c.beginPath();
    c.moveTo(-0.5, -0.5);
    c.lineTo(-0.08, -0.16);
    c.moveTo(0.5, -0.5);
    c.lineTo(0.08, -0.16);
    c.stroke();
  } else if (index === 1) {
    // bass clef-ish: note pair
    c.beginPath();
    c.ellipse(-0.25, 0.28, 0.16, 0.12, -0.3, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(0.31, 0.18, 0.16, 0.12, -0.3, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(-0.1, 0.26);
    c.lineTo(-0.1, -0.36);
    c.lineTo(0.46, -0.46);
    c.lineTo(0.46, 0.16);
    c.stroke();
  } else if (index === 2) {
    // keys
    roundRect(c, -0.48, -0.26, 0.96, 0.52, 0.08);
    c.stroke();
    c.beginPath();
    for (const kx of [-0.24, 0, 0.24]) {
      c.moveTo(kx, -0.26);
      c.lineTo(kx, 0.26);
    }
    c.stroke();
    c.fillRect(-0.3, -0.26, 0.12, 0.3);
    c.fillRect(0.18, -0.26, 0.12, 0.3);
  } else {
    // guitar
    c.beginPath();
    c.arc(-0.18, 0.2, 0.26, 0, TAU);
    c.stroke();
    c.beginPath();
    c.moveTo(0.02, 0.0);
    c.lineTo(0.46, -0.44);
    c.stroke();
    c.beginPath();
    c.arc(-0.18, 0.2, 0.07, 0, TAU);
    c.fill();
    c.fillRect(0.38, -0.54, 0.16, 0.16);
  }
  c.restore();
}

/** Fills a paw print centred on 0,0 that fits a circle of radius ~0.55*s. */
export function fillPaw(c, s = 1) {
  const pads = [
    [0, 0.2, 0.34, 0.28, 0], [-0.36, -0.16, 0.13, 0.17, -0.35], [-0.13, -0.38, 0.13, 0.18, -0.1],
    [0.13, -0.38, 0.13, 0.18, 0.1], [0.36, -0.16, 0.13, 0.17, 0.35],
  ];
  for (const [x, y, rx, ry, rot] of pads) {
    c.beginPath();
    c.ellipse(x * s, y * s, rx * s, ry * s, rot, 0, TAU);
    c.fill();
  }
}
