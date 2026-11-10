// Every body part comes in two versions: plain dog, and instrument.
// Coordinates are in the space of the rig node each part is attached to
// (see RIG and dog.js). +Z is the dog's nose, +Y is up.

import * as THREE from 'three';
import { G, part, group, bellGeo, tubeGeo, rod, tagAll } from './build.js';

export const RIG = {
  torsoY: 0.66,
  torsoR: 0.32,
  drumR: 0.35,
  drumHalf: 0.33,
  neck: [0, 0.9, 0.3],
  head: [0, 0.3, 0.14], // relative to neck
  headR: 0.4,
  legF: [0.19, 0.46, 0.27],
  legB: [0.2, 0.46, -0.27],
  tail: [0, 0.86, -0.42],
};

const HALF_PI = Math.PI / 2;
const XYLO_COLORS = ['#FF5D5D', '#FF9F45', '#FFD23F', '#7CE38B', '#3FD8FF', '#B48CFF'];

// ----------------------------------------------------------------- torso

export function torsoFur(M) {
  const g = group(null, [0, RIG.torsoY, 0]);
  part(g, G.capsule(RIG.torsoR, 0.34, 20), M.fur, { r: [HALF_PI, 0, 0] });
  part(g, G.sphere(1, 24, 16), M.furLight, { p: [0, -0.13, 0.03], s: [0.25, 0.22, 0.42] });
  part(g, G.sphere(0.25, 20, 14), M.furLight, { p: [0, 0.02, 0.27] });
  return tagAll(g, 'pet');
}

/** Percussion I — the belly is a drum. */
export function torsoDrum(M) {
  const R = RIG.drumR, H = RIG.drumHalf;
  const g = group(null, [0, RIG.torsoY, 0]);
  const drum = group(g, [0, 0, 0], [HALF_PI, 0, 0]); // cylinder axis -> Z
  part(drum, G.cyl(R, R, H * 2, 40, true), M.lacquer);
  part(drum, G.cyl(R - 0.008, R - 0.008, 0.012, 40), M.drumHead, { p: [0, H - 0.004, 0] });
  part(drum, G.cyl(R - 0.008, R - 0.008, 0.012, 40), M.drumHead, { p: [0, -H + 0.004, 0] });
  for (const y of [H, -H]) part(drum, G.torus(R + 0.004, 0.024, Math.PI * 2, 48, 10), M.silver, { p: [0, y, 0], r: [HALF_PI, 0, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.39;
    const x = Math.cos(a) * (R + 0.012), z = Math.sin(a) * (R + 0.012);
    part(drum, G.box(0.05, 0.11, 0.035), M.silver, { p: [x, 0, z], r: [0, -a + HALF_PI, 0] });
    rod(drum, [x, -H, z], [x, H, z], 0.007, M.silver);
  }
  // a tuft of fur where the pup meets the drum
  part(g, G.sphere(0.2, 18, 12), M.fur, { p: [0, 0.2, 0.26] });
  part(g, G.sphere(0.17, 18, 12), M.fur, { p: [0, 0.17, -0.3] });
  tagAll(drum, 'perc1');
  return tagAll(g, 'pet');
}

/** Percussion III — rainbow xylophone bars down both flanks. */
export function xylophoneRibs(M, torsoR) {
  const g = group(null, [0, RIG.torsoY, 0]);
  for (const side of [-1, 1]) {
    const x = side * (torsoR + 0.05);
    rod(g, [x - side * 0.02, 0.1, -0.42], [x - side * 0.02, 0.1, -0.02], 0.012, M.ebony);
    rod(g, [x - side * 0.02, -0.08, -0.42], [x - side * 0.02, -0.08, -0.02], 0.012, M.ebony);
    XYLO_COLORS.forEach((c, i) => {
      const z = -0.39 + i * 0.068;
      const h = 0.36 - i * 0.034;
      const bar = part(g, G.box(0.03, 1, 0.054), M.colored(c), { p: [x, 0.01, z], r: [0, 0, side * -0.14], s: [1, h, 1] });
      bar.userData.pulse = 'perc3';
      for (const dy of [0.3, -0.3]) part(g, G.sphere(0.009, 8, 6), M.silver, { p: [x + side * 0.016, 0.01 + dy * h, z] });
    });
  }
  return tagAll(g, 'perc3');
}

// ------------------------------------------------------------------ legs

export function legFur(M, front) {
  const g = group(null);
  part(g, G.sphere(0.125, 16, 12), M.fur, { p: [0, 0.02, 0] });
  part(g, G.capsule(0.088, 0.2, 14), M.fur, { p: [0, -0.2, 0] });
  part(g, G.sphere(1, 16, 12), M.furLight, { p: [0, -0.385, 0.035], s: [0.115, 0.082, 0.14] });
  return tagAll(g, 'pet');
}

/** Woodwinds I & II — clarinet front legs, bassoon hind legs. */
export function legWoodwind(M, kind, side) {
  const bassoon = kind === 'bassoon';
  const body = bassoon ? M.maroon : M.ebony;
  const metal = M.silver;
  const r = bassoon ? 0.074 : 0.064;
  const tag = bassoon ? 'wood2' : 'wood1';
  const g = group(null);
  part(g, G.sphere(0.125, 16, 12), M.fur, { p: [0, 0.02, 0], tag: 'pet' });
  const inst = group(g);
  part(inst, G.cyl(r, r, 0.3, 20), body, { p: [0, -0.2, 0] });
  for (const y of [-0.055, -0.2, -0.34]) part(inst, G.torus(r + 0.002, 0.013, Math.PI * 2, 24, 8), bassoon ? M.brass : metal, { p: [0, y, 0], r: [HALF_PI, 0, 0] });
  // keys down the front
  const keyYs = [-0.1, -0.15, -0.245, -0.295];
  keyYs.forEach((y, i) => {
    const key = part(inst, G.cyl(0.021, 0.021, 0.012, 14), metal, { p: [(i % 2 ? 0.022 : -0.022), y, r + 0.008], r: [HALF_PI, 0, 0] });
    key.userData.key = true;
  });
  rod(inst, [0.045, -0.08, r * 0.82], [0.045, -0.31, r * 0.82], 0.006, metal);
  // flared bell foot with toe beans peeking out
  const bell = new THREE.Mesh(bellGeo(r, bassoon ? 0.1 : 0.125, 0.11, 2.2, 28), bassoon ? M.maroon.clone() : body.clone());
  bell.material.side = THREE.DoubleSide;
  bell.rotation.x = Math.PI;
  bell.position.y = -0.345;
  bell.castShadow = true;
  inst.add(bell);
  if (bassoon) part(inst, G.torus(0.102, 0.014, Math.PI * 2, 28, 8), M.white, { p: [0, -0.452, 0], r: [HALF_PI, 0, 0] });
  part(inst, G.sphere(1, 14, 10), M.furLight, { p: [0, -0.425, 0.01], s: [0.075, 0.045, 0.085] });
  if (bassoon) {
    // the bocal: a silver crook curling off the top
    const { geo } = tubeGeo([[side * 0.07, -0.06, 0], [side * 0.13, 0.02, 0.01], [side * 0.14, 0.1, 0.05], [side * 0.1, 0.13, 0.11]], 0.012, { tubular: 20, radial: 8 });
    part(inst, geo, metal);
  }
  tagAll(inst, tag);
  return g;
}

// ------------------------------------------------------------------ tail

export function tailFur(M) {
  const g = group(null);
  part(g, G.capsule(0.055, 0.26, 12), M.fur, { p: [0, 0.16, -0.05], r: [-0.3, 0, 0] });
  part(g, G.sphere(0.07, 14, 10), M.furLight, { p: [0, 0.34, -0.105] });
  return tagAll(g, 'pet');
}

/** Strings I — the tail is a violin neck, scroll and all. */
export function tailViolin(M) {
  const g = group(null);
  part(g, G.sphere(0.085, 14, 10), M.fur, { tag: 'pet' });
  const v = group(g, [0, 0, 0], [-0.42, 0, 0]);
  part(v, G.box(0.062, 0.4, 0.046), M.wood, { p: [0, 0.2, 0] });
  part(v, G.box(0.05, 0.37, 0.014), M.ebony, { p: [0, 0.2, 0.03] });
  part(v, G.box(0.058, 0.11, 0.052), M.wood, { p: [0, 0.445, -0.004] });
  part(v, G.torus(0.04, 0.024, Math.PI * 1.7, 24, 10), M.wood, { p: [0, 0.535, -0.012], r: [0, HALF_PI, 0.4] });
  part(v, G.sphere(0.03, 12, 10), M.wood, { p: [0, 0.535, -0.012], s: [1.3, 1, 1] });
  [[0.405, -1], [0.432, 1], [0.459, -1], [0.486, 1]].forEach(([y, s]) => {
    part(v, G.cyl(0.011, 0.011, 0.1, 8), M.ebony, { p: [s * 0.05, y, 0], r: [0, 0, HALF_PI] });
    part(v, G.sphere(1, 10, 8), M.ebony, { p: [s * 0.105, y, 0], s: [0.012, 0.026, 0.026] });
  });
  [-0.018, -0.006, 0.006, 0.018].forEach((x) => {
    const s = rod(v, [x, 0.0, 0.042], [x * 0.7, 0.395, 0.042], 0.0035, M.string);
    s.userData.pulse = 'str1';
  });
  tagAll(v, 'str1');
  return g;
}

// ------------------------------------------------------------------ ears

export function earFur(M, side) {
  const g = group(null);
  part(g, G.sphere(1, 18, 14), M.furDark, { p: [side * 0.07, -0.2, 0], r: [0, 0, side * 0.28], s: [0.11, 0.27, 0.19] });
  return tagAll(g, 'pet');
}

/** Percussion II — ears are a pair of crash cymbals. */
export function earCymbal(M, side) {
  const g = group(null);
  part(g, G.box(0.03, 0.09, 0.05), M.leather, { p: [side * 0.035, -0.035, 0] });
  const pts = [[0.0, 0.045], [0.04, 0.044], [0.07, 0.03], [0.215, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  // angled forward so the cymbal face shows from the front
  const turn = group(g, [side * 0.06, -0.27, 0.02], [0, -side * 0.75, 0]);
  const c = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), M.gold);
  c.rotation.z = -side * HALF_PI;
  c.castShadow = true;
  c.userData.pulse = 'perc2';
  turn.add(c);
  part(turn, G.sphere(0.022, 10, 8), M.leather, { p: [side * 0.05, 0, 0] });
  return tagAll(g, 'perc2');
}

// ----------------------------------------------------------------- snout

export function snoutFur(M) {
  const g = group(null);
  part(g, G.sphere(1, 22, 16), M.furLight, { p: [0, -0.13, 0.29], s: [0.235, 0.17, 0.2] });
  part(g, G.sphere(1, 16, 12), M.nose, { p: [0, -0.075, 0.475], s: [0.078, 0.056, 0.058] });
  return tagAll(g, 'pet');
}

/** Brass I — a trumpet for a snout. Returns valve caps so they can be pressed. */
export function snoutTrumpet(M) {
  const g = group(null);
  // the jaw stays furry so the pup can still smile and pant
  part(g, G.sphere(1, 20, 14), M.furLight, { p: [0, -0.2, 0.27], s: [0.21, 0.12, 0.17], tag: 'pet' });
  const t = group(g, [0, -0.115, 0.3], [HALF_PI, 0, 0]); // +Y of this group points out of the face
  part(t, G.cyl(0.062, 0.07, 0.24, 24), M.brass, { p: [0, 0.11, 0] });
  const bell = new THREE.Mesh(bellGeo(0.062, 0.15, 0.17, 2.2), M.brass);
  bell.position.y = 0.225;
  bell.castShadow = true;
  bell.userData.pulse = 'brass1';
  t.add(bell);
  part(t, G.sphere(0.06, 16, 12), M.nose, { p: [0, 0.345, 0] });
  const valves = [];
  [0.06, 0.115, 0.17].forEach((y) => {
    part(t, G.cyl(0.024, 0.024, 0.09, 14), M.brass, { p: [0, y, -0.085], r: [HALF_PI, 0, 0] });
    const cap = part(t, G.cyl(0.021, 0.021, 0.02, 14), M.white, { p: [0, y, -0.138], r: [HALF_PI, 0, 0] });
    cap.userData.valve = true;
    valves.push(cap);
  });
  tagAll(t, 'brass1');
  g.userData.valves = valves;
  return g;
}

// ------------------------------------------------------------------ neck

export function collar(M) {
  const g = group(null, [0, 0.07, 0.035], [1.08, 0, 0]);
  part(g, G.torus(0.2, 0.03, Math.PI * 2, 32, 10), M.colored('#3FA7FF'));
  part(g, G.cyl(0.05, 0.05, 0.014, 18), M.tag, { p: [0, -0.215, -0.02], r: [HALF_PI, 0, 0] });
  return tagAll(g, 'pet');
}

/** Brass II — a French horn coiled around the neck. */
export function hornCollar(M) {
  const g = group(null, [0, 0.07, 0.035], [1.08, 0, 0]);
  part(g, G.torus(0.215, 0.034, Math.PI * 2, 40, 10), M.brass);
  part(g, G.torus(0.27, 0.026, Math.PI * 1.55, 40, 10), M.brass, { r: [0, 0, 2.2] });
  part(g, G.torus(0.165, 0.02, Math.PI * 2, 32, 8), M.brass, { p: [0, 0, 0.045] });
  // rotary valves on the right
  [-0.08, 0, 0.08].forEach((d) => {
    part(g, G.cyl(0.03, 0.03, 0.04, 14), M.silver, { p: [0.235, d, -0.02], r: [HALF_PI, 0, 0] });
  });
  // bell opens back and to the left, like a horn player's
  const b = group(g, [-0.3, -0.1, 0.08], [0.35, 0, 1.75]);
  const { geo } = tubeGeo([[0.0, -0.14, 0.03], [0.02, -0.06, 0.0], [0, 0, 0]], (u) => 0.026 + u * 0.012, { tubular: 16, radial: 10 });
  part(b, geo, M.brass);
  const bell = new THREE.Mesh(bellGeo(0.038, 0.22, 0.2, 2.5), M.brass);
  bell.castShadow = true;
  bell.userData.pulse = 'brass2';
  b.add(bell);
  return tagAll(g, 'brass2');
}

// ----------------------------------------------------------- back + body

/** Strings II — a cello fingerboard, bridge and strings along the spine. */
export function spineCello(M, topY) {
  const g = group(null);
  const y = topY;
  part(g, G.box(0.085, 0.016, 0.5), M.ebony, { p: [0, y + 0.006, -0.12] });
  part(g, G.box(0.12, 0.018, 0.1), M.ebony, { p: [0, y + 0.002, -0.4], r: [0.25, 0, 0] });
  part(g, G.box(0.13, 0.085, 0.012), M.woodLight, { p: [0, y + 0.045, -0.25] });
  // f-holes
  for (const s of [-1, 1]) {
    part(g, G.capsule(0.009, 0.1, 6), M.ebony, { p: [s * 0.11, y - 0.012, -0.22], r: [HALF_PI + 0.05, 0, s * 0.35] });
    part(g, G.sphere(0.014, 8, 6), M.ebony, { p: [s * 0.095, y - 0.006, -0.155] });
    part(g, G.sphere(0.014, 8, 6), M.ebony, { p: [s * 0.13, y - 0.02, -0.285] });
  }
  [-0.03, -0.01, 0.01, 0.03].forEach((x) => {
    const a = rod(g, [x * 1.2, y + 0.01, -0.43], [x * 1.3, y + 0.092, -0.25], 0.0045, M.string);
    const b = rod(g, [x * 1.3, y + 0.092, -0.25], [x * 0.8, y + 0.022, 0.12], 0.0045, M.string);
    a.userData.pulse = b.userData.pulse = 'str2';
  });
  return tagAll(g, 'str2');
}

/** Strings III — a golden concert harp rising from the back. */
export function harp(M, topY) {
  const g = group(null);
  const y0 = topY - 0.02;
  const zc = -0.4;
  part(g, G.cyl(0.026, 0.03, 0.74, 14), M.gold, { p: [0, y0 + 0.37, zc] });
  part(g, G.cyl(0.05, 0.06, 0.06, 14), M.gold, { p: [0, y0 + 0.03, zc] });
  part(g, G.sphere(0.05, 14, 10), M.gold, { p: [0, y0 + 0.78, zc] });
  part(g, G.torus(0.036, 0.012, Math.PI * 2, 20, 8), M.gold, { p: [0, y0 + 0.7, zc], r: [HALF_PI, 0, 0] });
  const pts = [[0, y0 + 0.74, zc], [0, y0 + 0.8, zc + 0.12], [0, y0 + 0.62, zc + 0.24], [0, y0 + 0.4, zc + 0.31], [0, y0 + 0.2, zc + 0.37], [0, y0 + 0.04, zc + 0.36]];
  const { geo, curve } = tubeGeo(pts, (u) => 0.028 - u * 0.006, { tubular: 40, radial: 10 });
  part(g, geo, M.gold);
  const N = 11;
  const P = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const u = 0.1 + (i / (N - 1)) * 0.8;
    curve.getPointAt(u, P);
    const mat = i % 7 === 0 ? M.stringRed : i % 7 === 3 ? M.stringBlue : M.string;
    const s = rod(g, [0, P.y - 0.01, P.z], [0, y0 + 0.02, P.z - 0.012], 0.004, mat);
    s.userData.pulse = 'str3';
  }
  return tagAll(g, 'str3');
}

/** Brass III — a sousaphone wrapped around the body, bell high above. */
export function sousaphone(M, torsoR) {
  const g = group(null);
  const R = torsoR + 0.1;
  const y = RIG.torsoY;
  const pts = [
    [0.2, y - R * 0.86, 0.1],
    [-0.12, y - R * 0.98, 0.07],
    [-R * 0.92, y - R * 0.32, 0.04],
    [-R * 0.9, y + R * 0.5, 0.01],
    [-0.12, y + R * 1.02, -0.02],
    [R * 0.74, y + R * 0.7, -0.05],
    [R * 1.0, y - 0.05, -0.08],
    [R * 0.7, y - R * 0.75, -0.11],
    [0, y - R * 1.02, -0.13],
    [-R * 0.86, y - R * 0.5, -0.15],
    [-R * 1.06, y + R * 0.4, -0.17],
    [-R * 1.0, y + R * 1.2, -0.2],
    [-R * 0.92, y + R * 1.85, -0.2],
    [-R * 0.86, y + R * 2.3, -0.12],
    [-R * 0.84, y + R * 2.48, 0.02],
  ];
  const { geo, curve } = tubeGeo(pts, (u) => 0.034 + u * 0.05, { tubular: 150, radial: 12 });
  part(g, geo, M.brass);
  const end = curve.getPointAt(1);
  const tan = curve.getTangentAt(1).normalize();
  const bell = new THREE.Mesh(bellGeo(0.084, 0.31, 0.27, 2.3, 44), M.brass);
  bell.position.copy(end);
  bell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
  bell.castShadow = true;
  bell.userData.pulse = 'brass3';
  g.add(bell);
  // valve block
  [0, 1, 2].forEach((i) => part(g, G.cyl(0.03, 0.03, 0.12, 12), M.silver, { p: [R * 0.98 + 0.03, y + 0.1 - i * 0.075, -0.05], r: [0, 0, HALF_PI] }));
  return tagAll(g, 'brass3');
}

/** Woodwinds III — a pan-flute mohawk. Attached to the head. */
export function panFluteMane(M) {
  const g = group(null);
  const N = 7;
  for (let i = 0; i < N; i++) {
    const th = 0.12 + (i / (N - 1)) * 1.15; // angle from "up" toward the back of the head
    const len = 0.3 - i * 0.028;
    const dir = new THREE.Vector3(0, Math.cos(th), -Math.sin(th));
    const base = dir.clone().multiplyScalar(RIG.headR * 0.93);
    const pipe = group(g, [base.x, base.y, base.z]);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const m = part(pipe, G.cyl(0.036, 0.036, 1, 14), M.bamboo, { p: [0, len / 2, 0], s: [1, len, 1] });
    m.userData.pulse = 'wood3';
    part(pipe, G.cyl(0.027, 0.027, 0.004, 12), M.ebony, { p: [0, len + 0.001, 0] });
    part(pipe, G.torus(0.037, 0.006, Math.PI * 2, 14, 6), M.leather, { p: [0, len * 0.55, 0], r: [HALF_PI, 0, 0] });
  }
  return tagAll(g, 'wood3');
}
