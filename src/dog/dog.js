// The pup: a small procedural rig, its instrument parts, and all of its
// animation (walking, sitting, sleeping, eating, dancing, being petted).

import * as THREE from 'three';
import { G, part, group, makeMaterials, tagAll } from './build.js';
import * as P from './parts.js';

const { RIG } = P;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const outBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

export const FAMILIES = ['perc', 'str', 'wood', 'brass'];

export class Dog {
  constructor() {
    this.root = new THREE.Group();
    this.levels = { perc: 0, str: 0, wood: 0, brass: 0 };
    this.coat = 'biscuit';
    this.pos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.target = null; // { x, z, speed, onArrive }
    this.pose = 'stand'; // stand | sit | lie | eat
    this.sit = 0;
    this.lie = 0;
    this.eat = 0;
    this.gait = 0;
    this.moving = 0;
    this.hop = 0;
    this.hopV = 0;
    this.happy = 0; // seconds of smiling eyes
    this.asleep = false;
    this.pant = 0;
    this.wag = 0;
    this.wagSpeed = 6;
    this.blink = 2;
    this.blinkT = 0;
    this.shake = 0; // seconds of wet-dog shake left
    this.dance = 0; // 0..1
    this.look = new THREE.Vector3(0, 1, 4);
    this.headYaw = 0;
    this.headPitch = 0;
    this.pulses = {};
    this.pops = [];
    this.carry = null; // object held in the mouth
    this.lieLift = 0; // raise the lying pose (e.g. onto the bed)
    this.t = 0;
    this.build(this.levels, this.coat);
  }

  // ----------------------------------------------------------------- build

  build(levels, coat) {
    this.levels = { ...levels };
    this.coat = coat;
    // drop the old model
    while (this.root.children.length) {
      const child = this.root.children[0];
      child.traverse((o) => {
        if (o.isMesh) {
          if (!o.geometry.userData.shared) o.geometry.dispose();
        }
      });
      this.root.remove(child);
    }
    if (this.M) Object.values(this.M).forEach((m) => m && m.dispose && m.dispose());
    const M = (this.M = makeMaterials(coat));
    const L = this.levels;
    const groups = (this.partGroups = {});
    const reg = (tag, g) => ((groups[tag] = groups[tag] || []).push(g), g);

    const body = (this.body = group(this.root));
    const drum = L.perc >= 1;
    const torsoR = drum ? RIG.drumR : RIG.torsoR;
    const topY = RIG.torsoY + torsoR;
    body.add(drum ? reg('perc1', P.torsoDrum(M)) : P.torsoFur(M));
    if (L.perc >= 3) body.add(reg('perc3', P.xylophoneRibs(M, torsoR)));
    if (L.str >= 2) body.add(reg('str2', P.spineCello(M, topY)));
    if (L.str >= 3) body.add(reg('str3', P.harp(M, topY)));
    if (L.brass >= 3) body.add(reg('brass3', P.sousaphone(M, torsoR)));

    // legs: FL, FR, BL, BR
    this.legs = [];
    for (const [front, side] of [[true, -1], [true, 1], [false, -1], [false, 1]]) {
      const base = front ? RIG.legF : RIG.legB;
      const pivot = group(body, [side * base[0], base[1], base[2]]);
      let leg;
      if (front && L.wood >= 1) leg = reg('wood1', P.legWoodwind(M, 'clarinet', side));
      else if (!front && L.wood >= 2) leg = reg('wood2', P.legWoodwind(M, 'bassoon', side));
      else leg = P.legFur(M, front);
      pivot.add(leg);
      this.legs.push(pivot);
    }

    // tail
    this.tail = group(body, RIG.tail);
    this.tail.add(L.str >= 1 ? reg('str1', P.tailViolin(M)) : P.tailFur(M));

    // neck + head
    const neck = (this.neck = group(body, RIG.neck));
    part(neck, G.sphere(0.21, 18, 12), M.fur, { tag: 'pet' });
    neck.add(L.brass >= 2 ? reg('brass2', P.hornCollar(M)) : P.collar(M));
    const head = (this.head = group(neck, RIG.head));
    part(head, G.sphere(RIG.headR, 32, 24), M.fur, { s: [1.08, 0.96, 1], tag: 'pet' });
    const snout = L.brass >= 1 ? reg('brass1', P.snoutTrumpet(M)) : P.snoutFur(M);
    head.add(snout);
    this.valves = snout.userData.valves || [];

    // mouth: a little "w", plus a tongue for panting
    const mouthY = L.brass >= 1 ? -0.225 : -0.155;
    const mouthZ = L.brass >= 1 ? 0.415 : 0.465;
    for (const s of [-1, 1]) part(head, G.torus(0.045, 0.011, Math.PI, 14, 6), M.mouth, { p: [s * 0.045, mouthY, mouthZ], r: [0.25, 0, Math.PI], cast: false });
    this.tongue = part(head, G.sphere(1, 12, 10), M.tongue, { p: [0, mouthY - 0.035, mouthZ - 0.015], s: [0.05, 0.07, 0.03], cast: false });

    // eyes
    this.eyes = [];
    this.eyeArcs = [];
    for (const s of [-1, 1]) {
      const eye = group(head, [s * 0.165, 0.055, 0.345]);
      part(eye, G.sphere(1, 16, 12), M.eye, { s: [0.064, 0.074, 0.045], cast: false });
      part(eye, G.sphere(0.021, 8, 6), M.white, { p: [0.018, 0.03, 0.036], cast: false });
      part(eye, G.sphere(0.01, 8, 6), M.white, { p: [-0.02, -0.02, 0.04], cast: false });
      this.eyes.push(eye);
      const arc = part(head, G.torus(0.052, 0.013, Math.PI, 14, 6), M.eye, { p: [s * 0.165, 0.04, 0.375], r: [-0.2, s * 0.35, 0], cast: false });
      arc.visible = false;
      this.eyeArcs.push(arc);
      part(head, G.disc(0.062, 18), M.blush, { p: [s * 0.275, -0.085, 0.3], r: [0, s * 0.82, 0], cast: false });
    }

    // ears
    this.ears = [];
    for (const s of [-1, 1]) {
      const pivot = group(head, [s * 0.33, 0.2, -0.03]);
      pivot.add(L.perc >= 2 ? reg('perc2', P.earCymbal(M, s)) : P.earFur(M, s));
      pivot.userData.side = s;
      this.ears.push(pivot);
    }
    if (L.wood >= 3) head.add(reg('wood3', P.panFluteMane(M)));

    // anything that should pulse when its instrument sounds
    this.pulseMeshes = [];
    this.root.traverse((o) => {
      if (o.isMesh && o.userData.pulse) {
        o.userData.base = o.scale.clone();
        this.pulseMeshes.push(o);
      }
    });
    this.valves.forEach((v) => (v.userData.baseZ = v.position.z));
    this.eyeTop = 1; // for blinks
  }

  /** Grow a freshly bought part in with a bounce. */
  popIn(tag) {
    for (const g of this.partGroups[tag] || []) {
      this.pops.push({ g, t: 0, base: g.scale.clone() });
      g.scale.setScalar(0.001);
    }
  }

  /** Flash the meshes of an instrument (called when it plays a note). */
  pulse(tag, amount = 1) {
    this.pulses[tag] = Math.max(this.pulses[tag] || 0, amount);
  }

  has(tag) {
    return !!this.partGroups[tag];
  }

  /** World position of a body part, for particles. */
  anchor(name, out = new THREE.Vector3()) {
    const node = name === 'head' ? this.head : name === 'tail' ? this.tail : this.body;
    node.getWorldPosition(out);
    if (name === 'body') out.y += RIG.torsoY;
    return out;
  }

  mouthWorld(out = new THREE.Vector3()) {
    out.set(0, -0.2, 0.52);
    return this.head.localToWorld(out);
  }

  // ------------------------------------------------------------- behaviour

  goTo(x, z, speed = 1.5, onArrive = null) {
    this.target = { x, z, speed, onArrive };
    if (this.pose !== 'stand') this.pose = 'stand';
  }

  stop() {
    this.target = null;
  }

  jump(v = 2.6) {
    if (this.hop === 0) this.hopV = v;
  }

  face(x, z) {
    this.faceYaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  // ---------------------------------------------------------------- update

  /**
   * @param env { beat: 0..1 pulse on each beat, bps, mood: 0..1, lookAt: Vector3|null }
   */
  update(dt, env) {
    this.t += dt;
    const t = this.t;

    // --- locomotion ---
    let speed = 0;
    if (this.target && this.lie < 0.1) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        const cb = this.target.onArrive;
        this.target = null;
        if (cb) cb();
      } else {
        const want = Math.atan2(dx, dz);
        this.yaw += angDiff(this.yaw, want) * (1 - Math.exp(-dt * 9));
        const facing = Math.max(0, Math.cos(angDiff(this.yaw, want)));
        speed = this.target.speed * facing * Math.min(1, d * 3 + 0.25);
        this.pos.x += Math.sin(this.yaw) * speed * dt;
        this.pos.z += Math.cos(this.yaw) * speed * dt;
      }
    } else if (this.faceYaw != null) {
      const d = angDiff(this.yaw, this.faceYaw);
      this.yaw += d * (1 - Math.exp(-dt * 6));
      if (Math.abs(d) < 0.02) this.faceYaw = null;
    }
    this.moving = damp(this.moving, speed > 0.05 ? 1 : 0, 10, dt);
    this.gait += dt * (4 + speed * 5.5) * (speed > 0.05 ? 1 : 0);

    // --- pose blends ---
    this.sit = damp(this.sit, this.pose === 'sit' ? 1 : 0, 7, dt);
    this.lie = damp(this.lie, this.pose === 'lie' ? 1 : 0, 5, dt);
    this.eat = damp(this.eat, this.pose === 'eat' ? 1 : 0, 7, dt);
    this.dance = damp(this.dance, env.dancing ? 1 : 0, 5, dt);

    // --- hop ---
    if (this.hopV !== 0 || this.hop > 0) {
      this.hopV -= 14 * dt;
      this.hop += this.hopV * dt;
      if (this.hop <= 0) {
        this.hop = 0;
        this.hopV = 0;
      }
    }

    const beat = env.beat || 0;
    const mood = env.mood ?? 1;
    const breathe = Math.sin(t * (this.asleep ? 1.4 : 2.6)) * (this.asleep ? 0.022 : 0.012);
    const walkBob = Math.abs(Math.sin(this.gait)) * 0.035 * this.moving;
    const sway = Math.sin(t * Math.PI * (env.bps || 1.6)) * 0.07 * this.dance;
    const shake = this.shake > 0 ? Math.sin(t * 46) * 0.32 * Math.min(1, this.shake * 2) : 0;
    this.shake = Math.max(0, this.shake - dt);

    this.root.position.set(this.pos.x, 0, this.pos.z);
    this.root.rotation.y = this.yaw + shake * 0.5;
    const body = this.body;
    body.position.y = this.hop + walkBob + beat * 0.07 * this.dance - this.sit * 0.035 - this.lie * (0.3 - this.lieLift);
    body.rotation.x = -0.3 * this.sit + 0.1 * this.eat;
    body.rotation.z = sway + shake * 0.25;
    body.scale.set(1 + breathe * 0.6, 1 + breathe, 1);

    // --- legs ---
    const A = 0.62 * this.moving;
    const swing = [Math.sin(this.gait), Math.sin(this.gait + Math.PI), Math.sin(this.gait + Math.PI), Math.sin(this.gait)];
    this.legs.forEach((leg, i) => {
      const front = i < 2;
      let rx = swing[i] * A;
      rx += front ? 0.3 * this.sit : -1.3 * this.sit;
      rx += (front ? -1.38 : 1.38) * this.lie;
      rx += this.hop > 0 ? (front ? -0.5 : 0.5) * Math.min(1, this.hop * 3) : 0;
      // little taps while dancing
      if (this.dance > 0.05 && (i === 0 || i === 3 ? beat : 0) > 0) rx += (front ? -0.35 : 0.2) * beat * this.dance * (Math.floor(t * (env.bps || 1.6)) % 2 === (i === 0 ? 0 : 1) ? 1 : 0);
      leg.rotation.x = rx;
      leg.rotation.z = (i % 2 ? -1 : 1) * 0.5 * this.lie * (front ? 0.3 : 0.6);
    });

    // --- tail ---
    this.wagSpeed = damp(this.wagSpeed, this.asleep ? 0.8 : 4 + mood * 6 + this.happy * 6 + this.dance * 4, 3, dt);
    this.wag += dt * this.wagSpeed;
    const wagAmp = this.asleep ? 0.05 : 0.22 + mood * 0.3 + (this.happy > 0 ? 0.25 : 0);
    this.tail.rotation.z = Math.sin(this.wag) * wagAmp;
    this.tail.rotation.x = -0.15 + this.lie * -0.9 + Math.sin(this.wag * 0.5) * 0.05 + (this.pulses.str1 || 0) * 0.15;

    // --- head ---
    let ty = 0, tp = 0;
    if (env.lookAt && !this.asleep && this.eat < 0.5) {
      const local = this.root.worldToLocal(this._v.copy(env.lookAt));
      local.y -= 1.2;
      local.z -= 0.44;
      ty = clamp(Math.atan2(local.x, Math.max(0.2, local.z)), -0.9, 0.9);
      tp = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.5, 0.45);
    }
    this.headYaw = damp(this.headYaw, ty, 6, dt);
    this.headPitch = damp(this.headPitch, tp, 6, dt);
    const nod = beat * 0.14 * this.dance;
    const eatBob = this.eat * (0.95 + Math.sin(t * 13) * 0.09);
    this.neck.rotation.x = eatBob + this.lie * 0.5 + this.sit * 0.2 + nod;
    this.neck.rotation.z = shake * 0.4;
    this.head.rotation.y = this.headYaw * (1 - this.eat);
    this.head.rotation.x = this.headPitch * (1 - this.eat) - this.lie * 0.15;
    this.head.rotation.z = Math.sin(t * 0.7) * 0.04 + (this.happy > 0 ? Math.sin(t * 9) * 0.05 : 0) + sway * 0.6 + (this.tilt || 0);
    this.tilt = damp(this.tilt || 0, 0, 1.2, dt);

    // --- face ---
    this.happy = Math.max(0, this.happy - dt);
    this.blink -= dt;
    if (this.blink <= 0) {
      this.blinkT = 0.13;
      this.blink = 1.8 + Math.random() * 3.6;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);
    const arcs = this.asleep || this.happy > 0;
    this.eyes.forEach((e) => {
      e.visible = !arcs;
      e.scale.y = this.blinkT > 0 ? 0.12 : 1;
    });
    this.eyeArcs.forEach((a) => {
      a.visible = arcs;
      a.rotation.z = this.asleep ? Math.PI : 0;
      a.position.y = this.asleep ? 0.075 : 0.04;
    });
    this.pant = damp(this.pant, !this.asleep && (this.happy > 0 || this.moving > 0.5 || mood > 0.75 || this.dance > 0.5) ? 1 : 0, 6, dt);
    this.tongue.scale.set(0.05, 0.02 + 0.06 * this.pant * (0.85 + 0.15 * Math.sin(t * 11)), 0.03);
    this.tongue.visible = this.pant > 0.08 && this.eat < 0.5;

    // --- ears: lag behind the head, flap on cymbal crashes ---
    const earLag = clamp(-this.hopV * 0.12 + walkBob * 6 + beat * 0.25 * this.dance, -0.5, 0.9);
    this.ears.forEach((ear) => {
      const s = ear.userData.side;
      const crash = (this.pulses.perc2 || 0) * 0.7;
      ear.rotation.z = s * (0.06 + earLag * 0.5 + crash + this.lie * 0.3 + Math.abs(shake) * 1.2);
      ear.rotation.x = Math.sin(t * 1.3 + s) * 0.03;
    });

    // --- instrument pulses ---
    for (const k of Object.keys(this.pulses)) this.pulses[k] = Math.max(0, this.pulses[k] - dt * 5.5);
    for (const m of this.pulseMeshes) {
      const p = this.pulses[m.userData.pulse] || 0;
      const b = m.userData.base;
      if (m.geometry.type === 'CylinderGeometry' && b.y === 1 && m.geometry.parameters.radiusTop < 0.006) {
        // strings: thicken + shimmer
        m.scale.set(b.x * (1 + p * 2.2), b.y, b.z * (1 + p * 2.2));
      } else {
        const k = 1 + p * 0.16;
        m.scale.set(b.x * k, b.y * k, b.z * k);
      }
    }
    const vp = this.pulses.brass1 || 0;
    this.valves.forEach((v, i) => (v.position.z = v.userData.baseZ + (i === Math.floor(t * 5) % 3 ? vp * 0.03 : 0)));

    // --- new parts popping in ---
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i];
      pop.t += dt / 0.7;
      const k = pop.t >= 1 ? 1 : Math.max(0.001, outBack(pop.t));
      pop.g.scale.copy(pop.base).multiplyScalar(k);
      if (pop.t >= 1) this.pops.splice(i, 1);
    }

    // --- held item ---
    if (this.carry) this.mouthWorld(this.carry.position);
  }
}
Dog.prototype._v = new THREE.Vector3();

export { tagAll };
