// Geometry + material helpers shared by the dog and its instrument parts.

import * as THREE from 'three';

export const COATS = {
  biscuit: { name: 'Biscuit', fur: '#F0A04B', light: '#FFF3DC', ear: '#C9702A', nose: '#3A2622' },
  cocoa: { name: 'Cocoa', fur: '#8B5A3C', light: '#E9CFA8', ear: '#5E3823', nose: '#241614' },
  snow: { name: 'Snow', fur: '#F4F1EA', light: '#FFFFFF', ear: '#8E9BB3', nose: '#2B2B33' },
  midnight: { name: 'Midnight', fur: '#4A4E69', light: '#C9CCE0', ear: '#2B2D42', nose: '#16161F' },
};

let blushTex = null;
function blushTexture() {
  if (blushTex) return blushTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,120,150,0.6)');
  g.addColorStop(0.6, 'rgba(255,120,150,0.3)');
  g.addColorStop(1, 'rgba(255,120,150,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  blushTex = new THREE.CanvasTexture(cv);
  blushTex.colorSpace = THREE.SRGBColorSpace;
  return blushTex;
}

/** Everything the dog is made of. One set per dog so coats can change. */
export function makeMaterials(coatId) {
  const coat = COATS[coatId] || COATS.biscuit;
  const fur = (color) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, metalness: 0, sheen: 0.55, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.3) });
  const std = (color, roughness = 0.5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    coat,
    fur: fur(coat.fur),
    furLight: fur(coat.light),
    furDark: fur(coat.ear),
    nose: std(coat.nose, 0.25, 0.1),
    eye: std('#17121c', 0.08, 0.2),
    white: std('#ffffff', 0.3),
    tongue: std('#FF7C93', 0.6),
    blush: new THREE.MeshBasicMaterial({ map: blushTexture(), transparent: true, depthWrite: false }),
    mouth: std('#5A1F2A', 0.7),
    brass: std('#F2B544', 0.2, 1, { side: THREE.DoubleSide }),
    gold: std('#FFD36A', 0.16, 1, { side: THREE.DoubleSide }),
    copper: std('#D98C4A', 0.24, 1, { side: THREE.DoubleSide }),
    silver: std('#E3E8EF', 0.2, 1),
    wood: new THREE.MeshPhysicalMaterial({ color: '#A8532B', roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    woodLight: new THREE.MeshPhysicalMaterial({ color: '#E0B271', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    maroon: new THREE.MeshPhysicalMaterial({ color: '#7B2D2D', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    ebony: std('#1D1B24', 0.3, 0.1),
    lacquer: new THREE.MeshPhysicalMaterial({ color: '#E8475F', roughness: 0.25, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 }),
    drumHead: std('#F6EFE2', 0.85),
    string: std('#F4F4F8', 0.3, 0.9),
    stringRed: std('#E5484D', 0.4, 0.3),
    stringBlue: std('#2B3A67', 0.4, 0.3),
    bamboo: std('#E6C67E', 0.6),
    leather: std('#6B3F2A', 0.7),
    tag: std('#FFD36A', 0.2, 1),
    colored: (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  };
}

/** Create a mesh, position it, add it to a parent. */
export function part(parent, geo, mat, { p = [0, 0, 0], r = [0, 0, 0], s = 1, cast = true, receive = false, tag = null } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  if (typeof s === 'number') m.scale.setScalar(s);
  else m.scale.set(s[0], s[1], s[2]);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (tag) m.userData.tag = tag;
  parent.add(m);
  return m;
}

export function group(parent, p = [0, 0, 0], r = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(p[0], p[1], p[2]);
  g.rotation.set(r[0], r[1], r[2]);
  if (parent) parent.add(g);
  return g;
}

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) {
    const geo = make();
    geo.userData.shared = true; // never disposed when a dog is rebuilt
    cache.set(key, geo);
  }
  return cache.get(key);
};

export const G = {
  sphere: (r = 1, w = 24, h = 16) => memo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
  cyl: (rt, rb, h, seg = 20, open = false) => memo(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  capsule: (r, len, seg = 16) => memo(`k${r},${len},${seg}`, () => new THREE.CapsuleGeometry(r, len, 8, seg)),
  torus: (R, r, arc = Math.PI * 2, seg = 40, tube = 10) => memo(`t${R},${r},${arc},${seg},${tube}`, () => new THREE.TorusGeometry(R, r, tube, seg, arc)),
  box: (x, y, z) => memo(`b${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z)),
  disc: (r, seg = 32) => memo(`d${r},${seg}`, () => new THREE.CircleGeometry(r, seg)),
};

/** A horn bell: flares from r0 to r1 along +Y over `len`. */
export function bellGeo(r0, r1, len, power = 2.6, seg = 36) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * Math.pow(t, power), t * len));
  }
  // rolled rim
  pts.push(new THREE.Vector2(r1 + 0.012, len - 0.004));
  pts.push(new THREE.Vector2(r1 + 0.006, len - 0.02));
  return new THREE.LatheGeometry(pts, seg);
}

/** A tube along a smooth path whose radius can change along its length. */
export function tubeGeo(points, radius, { tubular = 80, radial = 12, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed, 'centripetal');
  const rf = typeof radius === 'function' ? radius : () => radius;
  const frames = curve.computeFrenetFrames(tubular, closed);
  const pos = [];
  const nor = [];
  const idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    curve.getPointAt(u, P);
    const r = rf(u);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a), sy = Math.sin(a);
      const nx = cx * N.x + sy * B.x, ny = cx * N.y + sy * B.y, nz = cx * N.z + sy * B.z;
      pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
      nor.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return { geo, curve, frames };
}

/** Thin straight rod between two points (strings, rails, tension rods). */
export function rod(parent, a, b, radius, mat, tag) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  m.castShadow = radius > 0.008;
  if (tag) m.userData.tag = tag;
  parent.add(m);
  return m;
}

/** Tag every mesh under a group so taps can find which part was touched. */
export function tagAll(obj, tag) {
  obj.traverse((o) => {
    if (o.isMesh && !o.userData.tag) o.userData.tag = tag;
  });
  return obj;
}
