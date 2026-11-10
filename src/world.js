// The stage the pup lives on: renderer, lights, sky, props, camera, particles.

import * as THREE from 'three';
import { G, part, group, bellGeo, tubeGeo, tagAll } from './dog/build.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const FLOOR_R = 3.3;
export const SPOTS = {
  center: [0, 0.2],
  bowl: [-1.75, 1.0],
  bed: [1.8, -0.9],
  bath: [0, 0.2],
};

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping; // keeps the toy-bright colours saturated
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
    this.cam = { az: 0.5, el: 0.36, dist: 6.2, zoom: 1, target: new THREE.Vector3(0, 0.8, 0), lift: 0 };
    // Slide the whole picture on screen (fractions of the view) to make room for panels.
    this.shift = { x: 0, y: 0, tx: 0, ty: 0 };
    this.night = 0;
    this.nightTarget = 0;
    this.t = 0;
    this.ray = new THREE.Raycaster();
    this.particles = [];
    this.lowPower = false;

    this._sky();
    this._lights();
    this._environment();
    this._stage();
    this._props();
    this._particleTextures();
    this._floaters();
  }

  // ------------------------------------------------------------------ setup

  _sky() {
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 4;
    this.skyCanvas.height = 256;
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
    this._paintSky(0);

    // drifting clouds
    this.clouds = [];
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
    for (let i = 0; i < 7; i++) {
      const g = group(this.scene);
      const n = 4 + (i % 3);
      for (let k = 0; k < n; k++) {
        part(g, G.sphere(1, 12, 8), mat, { p: [(k - n / 2) * 0.75, Math.sin(k * 1.7) * 0.18, Math.cos(k * 2.3) * 0.3], s: 0.55 + ((k * 37) % 10) / 22, cast: false });
      }
      const a = (i / 7) * Math.PI * 2;
      g.userData = { a, r: 13 + (i % 3) * 3.5, y: -1.5 + (i % 4) * 2.3, sp: 0.012 + (i % 3) * 0.006 };
      g.scale.setScalar(1.2 + (i % 3) * 0.5);
      this.clouds.push(g);
    }
    // stars for night
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 260; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 1.6 - 0.6);
      pts.push(Math.sin(v) * Math.cos(u) * 40, Math.cos(v) * 40, Math.sin(v) * Math.sin(u) * 40);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, transparent: true, opacity: 0, depthWrite: false }));
    this.scene.add(this.stars);
  }

  _paintSky(night) {
    const c = this.skyCanvas.getContext('2d');
    const mix = (a, b) => `#${new THREE.Color(a).lerp(new THREE.Color(b), night).getHexString()}`;
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, mix('#58B4FF', '#070A26'));
    g.addColorStop(0.5, mix('#A8DCFF', '#1B2259'));
    g.addColorStop(0.8, mix('#FFE8C9', '#3B2F7A'));
    g.addColorStop(1, mix('#FFD1B8', '#553C8B'));
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 256);
    this.skyTex.needsUpdate = true;
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight('#EAF4FF', '#FFC998', 0.75);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#FFF1D6', 2.1));
    sun.position.set(3.5, 7, 4.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4.6;
    sun.shadow.camera.right = 4.6;
    sun.shadow.camera.top = 4.6;
    sun.shadow.camera.bottom = -4.6;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 20;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 5;
    this.scene.add(sun);
    this.rim = new THREE.DirectionalLight('#9AD0FF', 0.55);
    this.rim.position.set(-4, 3, -5);
    this.scene.add(this.rim);
    // warm lamp that comes on at night
    this.lamp = new THREE.PointLight('#FFC27A', 0, 9, 1.6);
    this.lamp.position.set(1.2, 2.2, -0.2);
    this.scene.add(this.lamp);
  }

  /** A tiny studio rendered into a cube map so brass has something to reflect. */
  _environment() {
    const env = new THREE.Scene();
    const tex = canvasTex(8, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#BFE4FF');
      g.addColorStop(0.45, '#FFF6E6');
      g.addColorStop(0.55, '#F6D7B0');
      g.addColorStop(1, '#8A5A3C');
      c.fillStyle = g;
      c.fillRect(0, 0, 8, 256);
    });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: new THREE.Color(0.36, 0.36, 0.36) })));
    const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(11, 10.2, 9) });
    const coolMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 5, 8) });
    const add = (m, x, y, z, sx, sy) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), m);
      mesh.position.set(x, y, z);
      mesh.lookAt(0, 0, 0);
      env.add(mesh);
    };
    add(lightMat, 6, 9, 6, 7, 7);
    add(lightMat, -8, 5, 3, 3, 6);
    add(coolMat, -5, 4, -8, 6, 5);
    add(lightMat, 2, 2, 10, 5, 1.2);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(env, 0.03).texture;
    pmrem.dispose();
  }

  _stage() {
    const s = this.scene;
    const wood = canvasTex(1024, 1024, (c, w, h) => {
      c.fillStyle = '#E2B27A';
      c.fillRect(0, 0, w, h);
      const plank = 64;
      for (let y = 0; y < h; y += plank) {
        const tone = 18 * Math.sin(y * 0.37);
        c.fillStyle = `rgb(${226 + tone},${178 + tone},${122 + tone * 0.8})`;
        c.fillRect(0, y, w, plank);
        c.fillStyle = 'rgba(120,70,30,0.35)';
        c.fillRect(0, y, w, 2);
        const off = ((y / plank) % 2) * 190 + 60;
        for (let x = off; x < w; x += 380) c.fillRect(x, y, 2, plank);
        c.strokeStyle = 'rgba(150,95,45,0.14)';
        c.lineWidth = 1.5;
        for (let k = 0; k < 5; k++) {
          c.beginPath();
          const yy = y + 8 + k * 11;
          c.moveTo(0, yy);
          for (let x = 0; x <= w; x += 64) c.lineTo(x, yy + Math.sin(x * 0.02 + y + k) * 3);
          c.stroke();
        }
      }
    });
    this.floor = part(s, G.cyl(FLOOR_R, FLOOR_R, 0.22, 72), [std('#B9784A', 0.6), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }), std('#8A5633', 0.7)], { p: [0, -0.11, 0], cast: false, receive: true });
    part(s, G.torus(FLOOR_R, 0.085, Math.PI * 2, 96, 10), std('#7A4526', 0.45), { p: [0, -0.02, 0], r: [Math.PI / 2, 0, 0], cast: false, receive: true });
    // the island under the stage
    part(s, G.cyl(FLOOR_R * 0.97, FLOOR_R * 0.55, 1.1, 48), std('#F3E3C8', 0.9), { p: [0, -0.77, 0], cast: false });
    part(s, G.cyl(FLOOR_R * 0.55, FLOOR_R * 0.12, 1.0, 40), std('#E7C9A2', 0.9), { p: [0, -1.82, 0], cast: false });
    part(s, G.torus(FLOOR_R * 0.98, 0.07, Math.PI * 2, 96, 8), std('#3FA7FF', 0.5), { p: [0, -0.3, 0], r: [Math.PI / 2, 0, 0], cast: false });

    // rug with a treble-clef-free, simple star
    const rug = canvasTex(512, 512, (c) => {
      c.translate(256, 256);
      const rings = [['#FF8FA8', 250], ['#FFF3DC', 228], ['#7C6BFF', 212], ['#FFF3DC', 150], ['#FFD23F', 138]];
      for (const [col, r] of rings) {
        c.fillStyle = col;
        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#FFF3DC';
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 50 : 112;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    });
    part(s, G.disc(1.75, 64), new THREE.MeshStandardMaterial({ map: rug, roughness: 0.95, transparent: true }), { p: [0, 0.006, 0.2], r: [-Math.PI / 2, 0, 0], cast: false, receive: true });

    // bunting between two poles at the back
    const colors = ['#FF5D8F', '#FFD23F', '#3FD8FF', '#7CE38B', '#B48CFF', '#FF8A3D'];
    const poleMat = std('#F7F1E3', 0.5);
    const ends = [[-2.75, -1.55], [2.75, -1.55]];
    for (const [x, z] of ends) {
      part(s, G.cyl(0.05, 0.065, 2.6, 12), poleMat, { p: [x, 1.3, z] });
      part(s, G.sphere(0.1, 14, 10), std('#FFD23F', 0.3, 0.6), { p: [x, 2.66, z] });
    }
    const sag = (u) => 2.5 - Math.sin(u * Math.PI) * 0.55;
    const line = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      line.push([lerp(ends[0][0], ends[1][0], u), sag(u), -1.55 - Math.sin(u * Math.PI) * 1.2]);
    }
    this.bunting = group(s);
    part(this.bunting, tubeGeo(line, 0.012, { tubular: 48, radial: 6 }).geo, std('#6B4A2E', 0.8), { cast: false });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
    tri.computeVertexNormals();
    this.flags = [];
    for (let i = 1; i < 16; i++) {
      const [x, y, z] = line[i];
      const f = part(this.bunting, tri, new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.8, side: THREE.DoubleSide }), { p: [x, y - 0.01, z], r: [0, Math.atan2(-x, 3.2) * 0.5, 0] });
      this.flags.push(f);
    }

    // potted plants
    for (const [x, z, sc] of [[-2.55, -0.6, 1], [0.55, -2.7, 0.85]]) {
      const g = group(s, [x, 0, z]);
      g.scale.setScalar(sc);
      part(g, G.cyl(0.24, 0.18, 0.34, 18), std('#E8785A', 0.7), { p: [0, 0.17, 0] });
      part(g, G.torus(0.245, 0.03, Math.PI * 2, 20, 8), std('#D4603F', 0.7), { p: [0, 0.34, 0], r: [Math.PI / 2, 0, 0] });
      const leaf = std('#4FB56A', 0.75);
      const leaf2 = std('#6FD08A', 0.75);
      [[0, 0.62, 0, 0.3], [0.17, 0.5, 0.06, 0.2], [-0.16, 0.52, -0.05, 0.21], [0.03, 0.85, -0.03, 0.2], [-0.08, 0.7, 0.14, 0.17]].forEach(([lx, ly, lz, r], i) =>
        part(g, G.sphere(1, 14, 10), i % 2 ? leaf2 : leaf, { p: [lx, ly, lz], s: r }),
      );
    }

    // a music stand, because this is a rehearsal room
    const st = group(s, [-1.35, 0, -1.95], [0, 0.45, 0]);
    const metal = std('#3A3D52', 0.35, 0.8);
    part(st, G.cyl(0.02, 0.02, 1.15, 8), metal, { p: [0, 0.58, 0] });
    for (let i = 0; i < 3; i++) part(st, G.cyl(0.014, 0.014, 0.42, 6), metal, { p: [Math.sin((i * Math.PI * 2) / 3) * 0.15, 0.07, Math.cos((i * Math.PI * 2) / 3) * 0.15], r: [Math.cos((i * Math.PI * 2) / 3) * 1.2, 0, -Math.sin((i * Math.PI * 2) / 3) * 1.2] });
    part(st, G.box(0.62, 0.42, 0.02), metal, { p: [0, 1.28, 0.03], r: [-0.3, 0, 0] });
    const sheet = canvasTex(256, 180, (c, w, h) => {
      c.fillStyle = '#FFFDF5';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#3A3D52';
      c.lineWidth = 1.5;
      for (let row = 0; row < 3; row++) {
        for (let l = 0; l < 5; l++) {
          c.beginPath();
          c.moveTo(14, 24 + row * 52 + l * 6);
          c.lineTo(w - 14, 24 + row * 52 + l * 6);
          c.stroke();
        }
        c.fillStyle = '#3A3D52';
        for (let n = 0; n < 9; n++) {
          const x = 30 + n * 24, y = 24 + row * 52 + ((n * 7 + row * 3) % 6) * 4;
          c.beginPath();
          c.ellipse(x, y, 5, 3.6, -0.4, 0, Math.PI * 2);
          c.fill();
          c.fillRect(x + 4, y - 18, 1.5, 18);
        }
      }
    });
    part(st, new THREE.PlaneGeometry(0.56, 0.38), new THREE.MeshStandardMaterial({ map: sheet, roughness: 0.9 }), { p: [0, 1.285, 0.045], r: [-0.3, 0, 0], cast: false });
  }

  _props() {
    const s = this.scene;
    // food bowl
    const bowl = (this.bowl = group(s, [SPOTS.bowl[0] - 0.38, 0, SPOTS.bowl[1] + 0.22]));
    const pts = [[0.16, 0], [0.26, 0.02], [0.29, 0.13], [0.26, 0.15], [0.22, 0.06], [0, 0.045]].map(([x, y]) => new THREE.Vector2(x, y));
    part(bowl, new THREE.LatheGeometry(pts, 32), std('#FF5D6C', 0.3, 0, { side: THREE.DoubleSide }), { receive: true });
    this.kibble = group(bowl, [0, 0.07, 0]);
    const kib = std('#9B6235', 0.8);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, r = 0.03 + (i % 5) * 0.036;
      part(this.kibble, G.sphere(0.036, 8, 6), kib, { p: [Math.cos(a) * r, 0.02 + (i % 3) * 0.022, Math.sin(a) * r], cast: false });
    }
    this.kibble.visible = false;

    // bed
    const bed = (this.bed = group(s, [SPOTS.bed[0], 0, SPOTS.bed[1]]));
    part(bed, G.torus(0.62, 0.2, Math.PI * 2, 40, 14), std('#6C7BFF', 0.9), { p: [0, 0.17, 0], r: [Math.PI / 2, 0, 0], receive: true });
    part(bed, G.cyl(0.62, 0.62, 0.14, 32), std('#FFF3DC', 0.95), { p: [0, 0.1, 0], receive: true });

    // ball
    this.ball = part(s, G.sphere(0.15, 20, 14), std('#FF5D8F', 0.4), { p: [2.3, 0.15, 0.7] });
    part(this.ball, G.torus(0.151, 0.022, Math.PI * 2, 28, 8), std('#FFFFFF', 0.4), { cast: false });
    part(this.ball, G.torus(0.151, 0.022, Math.PI * 2, 28, 8), std('#FFD23F', 0.4), { r: [Math.PI / 2, 0, 0], cast: false });
    this.ballV = new THREE.Vector3();
    this.ballHome = new THREE.Vector3(2.3, 0.15, 0.7);
    this.ballFree = false;

    // bath tub (hidden until bath time)
    const tub = (this.tub = group(s, [SPOTS.bath[0], 0, SPOTS.bath[1]]));
    const tp = [[0.62, 0], [0.82, 0.04], [0.9, 0.42], [0.84, 0.44], [0.76, 0.1], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y));
    part(tub, new THREE.LatheGeometry(tp, 40), std('#FFFFFF', 0.25, 0, { side: THREE.DoubleSide }), { receive: true });
    part(tub, G.torus(0.87, 0.045, Math.PI * 2, 48, 10), std('#3FD8FF', 0.3), { p: [0, 0.43, 0], r: [Math.PI / 2, 0, 0] });
    part(tub, G.cyl(0.8, 0.78, 0.02, 40), new THREE.MeshStandardMaterial({ color: '#9BE4FF', roughness: 0.08, transparent: true, opacity: 0.75 }), { p: [0, 0.3, 0], cast: false });
    tub.scale.setScalar(0.001);
    tub.visible = false;
    this.tubK = 0;
    this.tubTarget = 0;

    // tip jar: fills with gold while the pup busks
    const jar = (this.jar = group(s, [1.04, 0, 0.95]));
    const glass = new THREE.MeshPhysicalMaterial({ color: '#DDF3FF', roughness: 0.05, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    const gold = std('#FFC83D', 0.25, 0.9);
    part(jar, G.cyl(0.21, 0.19, 0.44, 28, true), glass, { p: [0, 0.23, 0], cast: false });
    part(jar, G.cyl(0.19, 0.19, 0.02, 28), std('#BFD9E8', 0.3), { p: [0, 0.01, 0] });
    part(jar, G.torus(0.21, 0.018, Math.PI * 2, 32, 8), std('#FFFFFF', 0.3), { p: [0, 0.45, 0], r: [Math.PI / 2, 0, 0] });
    this.jarGold = part(jar, G.cyl(0.175, 0.165, 1, 24), gold, { p: [0, 0.03, 0], s: [1, 0.02, 1] });
    this.jarCoins = group(jar);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      part(this.jarCoins, G.cyl(0.05, 0.05, 0.014, 14), gold, { p: [Math.cos(a) * 0.09 * (i ? 1 : 0), 0.012 + (i % 3) * 0.012, Math.sin(a) * 0.09 * (i ? 1 : 0)], r: [0.3 * Math.sin(a), 0, 0.3 * Math.cos(a)], cast: false });
    }
    // invisible, generous tap target
    part(jar, G.cyl(0.3, 0.3, 0.6, 12), new THREE.MeshBasicMaterial({ visible: false }), { p: [0, 0.3, 0], cast: false });
    tagAll(jar, 'jar');
    this.jarFill = 0;
    this.jarPop = 0;

    // today's gift
    const gift = (this.gift = group(s, [0.3, 0, 1.3]));
    const wrap = std('#FF5D8F', 0.5);
    const ribbon = std('#FFD23F', 0.35, 0.3);
    part(gift, G.box(0.42, 0.34, 0.42), wrap, { p: [0, 0.17, 0] });
    part(gift, G.box(0.46, 0.1, 0.46), std('#FF7DA6', 0.5), { p: [0, 0.37, 0] });
    part(gift, G.box(0.1, 0.44, 0.47), ribbon, { p: [0, 0.21, 0] });
    part(gift, G.box(0.47, 0.44, 0.1), ribbon, { p: [0, 0.21, 0] });
    for (const sgn of [-1, 1]) part(gift, G.torus(0.085, 0.03, Math.PI * 2, 18, 8), ribbon, { p: [sgn * 0.085, 0.49, 0], r: [0, 0, sgn * 0.5] });
    part(gift, G.box(0.6, 0.7, 0.6), new THREE.MeshBasicMaterial({ visible: false }), { p: [0, 0.35, 0], cast: false });
    tagAll(gift, 'gift');
    gift.visible = false;

    this.tappables = [jar, gift];
  }

  /** Everything that floats: the golden note and the Virtuoso star halo. */
  _floaters() {
    const g = (this.golden = new THREE.Group());
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: '#FFE27A', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.3);
    const noteSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.note, color: '#FFD23F', transparent: true, depthWrite: false }));
    noteSp.scale.setScalar(0.55);
    g.add(glow, noteSp);
    g.userData.glow = glow;
    g.visible = false;
    this.scene.add(g);

    this.halo = [];
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.star, color: '#FFD23F', transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.17);
      sp.visible = false;
      this.scene.add(sp);
      this.halo.push(sp);
    }
  }

  setJar(fill) {
    if (fill > this.jarFill + 0.02) this.jarPop = 1;
    this.jarFill = fill;
  }

  /** Screen position (CSS px) of a world point, for tap tests on sprites. */
  toScreen(v) {
    const q = v.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height, behind: q.z > 1 };
  }

  _particleTextures() {
    const make = (draw) => canvasTex(96, 96, (c) => {
      c.translate(48, 48);
      draw(c);
    });
    this.tex = {
      heart: make((c) => {
        c.fillStyle = '#FF5D8F';
        c.beginPath();
        c.moveTo(0, 30);
        c.bezierCurveTo(-52, -6, -22, -44, 0, -18);
        c.bezierCurveTo(22, -44, 52, -6, 0, 30);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath();
        c.ellipse(-14, -14, 7, 5, -0.6, 0, Math.PI * 2);
        c.fill();
      }),
      note: make((c) => {
        c.fillStyle = '#FFFFFF';
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 7;
        c.lineCap = 'round';
        c.beginPath();
        c.ellipse(-8, 20, 15, 11, -0.4, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(5, 16);
        c.lineTo(5, -30);
        c.quadraticCurveTo(22, -24, 30, -4);
        c.stroke();
      }),
      star: make((c) => {
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 15 : 38;
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
        c.fill();
      }),
      bubble: make((c) => {
        const g = c.createRadialGradient(-10, -12, 2, 0, 0, 40);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.6, 'rgba(190,235,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0.8)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, 38, 0, Math.PI * 2);
        c.fill();
      }),
      zzz: make((c) => {
        c.fillStyle = '#FFFFFF';
        c.font = '700 64px Fredoka, ui-rounded, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('z', 0, 0);
      }),
      glow: make((c) => {
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 46);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.3, 'rgba(255,255,255,0.4)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(-48, -48, 96, 96);
      }),
      drop: make((c) => {
        c.fillStyle = '#8FDFFF';
        c.beginPath();
        c.moveTo(0, -34);
        c.bezierCurveTo(30, 6, 22, 32, 0, 32);
        c.bezierCurveTo(-22, 32, -30, 6, 0, -34);
        c.fill();
      }),
    };
  }

  // ----------------------------------------------------------- particles

  /** Spawn a sprite particle. kind: heart | note | star | bubble | zzz | drop */
  emit(kind, pos, { color = '#ffffff', size = 0.3, life = 1.2, vel = [0, 1, 0], gravity = 0, spin = 0, grow = 0 } = {}) {
    if (this.particles.length > (this.lowPower ? 60 : 140)) return;
    const mat = new THREE.SpriteMaterial({ map: this.tex[kind], color, transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    this.scene.add(sp);
    this.particles.push({ sp, life, age: 0, vel: new THREE.Vector3(...vel), gravity, spin, size, grow });
  }

  burst(kind, pos, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 1.2) * (0.5 + Math.random() * 0.8);
      this.emit(kind, pos, {
        ...opts,
        size: (opts.size ?? 0.26) * (0.7 + Math.random() * 0.6),
        life: (opts.life ?? 1.1) * (0.7 + Math.random() * 0.6),
        vel: [Math.cos(a) * sp * (opts.spread ?? 1), (opts.up ?? 1.4) * (0.6 + Math.random() * 0.8), Math.sin(a) * sp * (opts.spread ?? 1)],
        color: Array.isArray(opts.colors) ? opts.colors[i % opts.colors.length] : opts.color,
      });
    }
  }

  // --------------------------------------------------------------- props

  showTub(on) {
    this.tubTarget = on ? 1 : 0;
    if (on) this.tub.visible = true;
  }

  throwBall(x, z) {
    this.ballFree = true;
    this.ball.visible = true;
    const from = this.ball.position;
    const dx = x - from.x, dz = z - from.z;
    const T = 0.75;
    this.ballV.set(dx / T, 4.2, dz / T);
  }

  // -------------------------------------------------------------- picking

  /** Returns { tag, point } for the nearest dog part / floor under a pointer. */
  pick(nx, ny, dogRoot) {
    this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hits = this.ray.intersectObject(dogRoot, true);
    for (const h of hits) {
      if (h.object.userData.tag && h.object.visible) return { tag: h.object.userData.tag, point: h.point, onDog: true };
    }
    const props = this.ray.intersectObjects(this.tappables.filter((t) => t.visible), true);
    if (props.length) return { tag: props[0].object.userData.tag, point: props[0].point, onDog: false };
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(plane, p) && Math.hypot(p.x, p.z) < FLOOR_R - 0.25) return { tag: 'floor', point: p, onDog: false };
    return null;
  }

  // --------------------------------------------------------------- frame

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > 3.2e6) dpr = Math.sqrt(3.2e6 / (w * h));
    if (this.lowPower) dpr = Math.min(dpr, 1.25);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(low) {
    this.lowPower = low;
    this.sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  update(dt, focus) {
    this.t += dt;
    const t = this.t;

    // day / night
    if (Math.abs(this.night - this.nightTarget) > 0.002) {
      this.night = lerp(this.night, this.nightTarget, 1 - Math.exp(-dt * 2.2));
      const n = this.night;
      this._paintSky(n);
      this.sun.intensity = lerp(2.1, 0.22, n);
      this.sun.color.set('#FFF3DC').lerp(new THREE.Color('#8FA8FF'), n);
      this.hemi.intensity = lerp(0.75, 0.22, n);
      this.rim.intensity = lerp(0.55, 0.4, n);
      this.lamp.intensity = n * 9;
      this.stars.material.opacity = n * 0.9;
      this.renderer.toneMappingExposure = lerp(1, 0.8, n);
      this.clouds.forEach((c) => c.children.forEach((m) => (m.material.opacity = lerp(0.92, 0.25, n))));
    }
    for (const c of this.clouds) {
      const u = c.userData;
      u.a += dt * u.sp;
      c.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r);
    }
    this.flags.forEach((f, i) => (f.rotation.x = Math.sin(t * 2 + i * 0.8) * 0.18));

    // tub pop
    if (this.tubK !== this.tubTarget) {
      this.tubK = lerp(this.tubK, this.tubTarget, 1 - Math.exp(-dt * 9));
      if (Math.abs(this.tubK - this.tubTarget) < 0.004) this.tubK = this.tubTarget;
      this.tub.scale.setScalar(Math.max(0.001, this.tubK));
      if (this.tubK === 0) this.tub.visible = false;
    }

    // tip jar: gold level, a little hop whenever it gains, a wobble when brimming
    const jf = this.jarFill;
    this.jarGold.scale.y = 0.02 + jf * 0.36;
    this.jarGold.position.y = 0.03 + (0.02 + jf * 0.36) / 2;
    this.jarCoins.position.y = 0.04 + jf * 0.36;
    this.jarCoins.visible = jf > 0.03;
    this.jarPop = Math.max(0, this.jarPop - dt * 4);
    const wob = jf >= 0.999 ? Math.abs(Math.sin(t * 5)) * 0.08 : 0;
    this.jar.scale.set(1 + this.jarPop * 0.08, 1 - this.jarPop * 0.06 + wob * 0.5, 1 + this.jarPop * 0.08);
    this.jar.position.y = wob;
    if (this.gift.visible) {
      this.gift.position.y = Math.abs(Math.sin(t * 3.2)) * 0.14;
      this.gift.rotation.y = Math.sin(t * 1.6) * 0.25;
    }
    if (this.golden.visible) this.golden.userData.glow.scale.setScalar(1.2 + Math.sin(t * 6) * 0.2);

    // ball physics
    if (this.ballFree) {
      const b = this.ball.position;
      this.ballV.y -= 11 * dt;
      b.addScaledVector(this.ballV, dt);
      this.ball.rotation.x += this.ballV.z * dt * 5;
      this.ball.rotation.z -= this.ballV.x * dt * 5;
      if (b.y < 0.15) {
        b.y = 0.15;
        this.ballV.y = Math.abs(this.ballV.y) * 0.5;
        this.ballV.x *= 0.72;
        this.ballV.z *= 0.72;
        if (this.ballV.y < 0.5) this.ballV.y = 0;
        if (this.onBounce && this.ballV.y > 0.6) this.onBounce();
      }
      const r = Math.hypot(b.x, b.z);
      if (r > FLOOR_R - 0.35) {
        b.multiplyScalar((FLOOR_R - 0.35) / r);
        this.ballV.x *= -0.4;
        this.ballV.z *= -0.4;
      }
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.scene.remove(p.sp);
        p.sp.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      p.vel.y -= p.gravity * dt;
      p.sp.position.addScaledVector(p.vel, dt);
      p.sp.material.opacity = k < 0.12 ? k / 0.12 : 1 - Math.pow((k - 0.12) / 0.88, 2);
      p.sp.material.rotation += p.spin * dt;
      p.sp.scale.setScalar(p.size * (1 + p.grow * k) * (k < 0.12 ? 0.5 + (k / 0.12) * 0.5 : 1));
    }

    // camera
    const cam = this.cam;
    if (focus) cam.target.lerp(new THREE.Vector3(focus.x, 0.78 + cam.lift, focus.z), 1 - Math.exp(-dt * 3));
    const portrait = this.aspect < 0.9;
    const fit = portrait ? clamp(0.62 / this.aspect, 1, 1.7) : 1;
    const d = cam.dist * cam.zoom * fit;
    const el = cam.el;
    this.camera.position.set(cam.target.x + Math.sin(cam.az) * Math.cos(el) * d, cam.target.y + Math.sin(el) * d, cam.target.z + Math.cos(cam.az) * Math.cos(el) * d);
    this.camera.lookAt(cam.target.x, cam.target.y + (portrait ? -0.15 : 0.05), cam.target.z);
    // the bunting would hang in front of the lens when looking from behind the stage
    this.bunting.visible = this.camera.position.z > -1.4;
    const sh = this.shift;
    sh.x = lerp(sh.x, sh.tx, 1 - Math.exp(-dt * 5));
    sh.y = lerp(sh.y, sh.ty, 1 - Math.exp(-dt * 5));
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (Math.abs(sh.x) > 0.001 || Math.abs(sh.y) > 0.001) this.camera.setViewOffset(w, h, sh.x * w, sh.y * h, w, h);
    else if (this.camera.view) this.camera.clearViewOffset();
  }

  /** Move the scene on screen: +y pushes it up, +x pushes it left. */
  setShift(x, y) {
    this.shift.tx = x;
    this.shift.ty = y;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export { bellGeo };
