import * as THREE from "three";

// Procedural animation for skinned humanoids whose skeletons come from different tools
// (3ds Max Biped, Mixamo, Blender rigs, hand-made rigs). Instead of retargeting clips,
// every limb is aimed at a direction in the character's own space (+Z forward, +Y up,
// +X to the character's left), so a T-pose, an A-pose and a relaxed bind all land in
// the same stance.

type Side = "l" | "r";
export type Slot =
  | "hips" | "spine" | "chest" | "neck" | "head"
  | "armL" | "foreL" | "handL" | "armR" | "foreR" | "handR"
  | "thighL" | "shinL" | "footL" | "thighR" | "shinR" | "footR";

// Name patterns per slot, matched against a canonical name (lower case, Sketchfab's "_12"
// suffix and every separator removed). Side is resolved from rest position, not from the
// name, because a few rigs are mirrored.
const PATTERNS: Record<string, RegExp[]> = {
  hips: [/^(mixamorig)?hips\d?$/, /pelvis$/],
  spine: [/^(mixamorig)?spine$/, /^bip0?01spine$/, /^spine0?1$/],
  chest: [/^(mixamorig)?spine2$/, /^bip0?01spine2$/, /^chest\d?$/, /^spine03$/, /^torso$/],
  neck: [/^(mixamorig)?neck\d?$/, /^bip0?01neck$/],
  head: [/^(mixamorig)?head\d?$/, /^bip0?01head$/],
  arm: [/(left|right)arm$/, /^bip0?01[lr]upperarm$/, /^[lr]arm\d?$/, /^upperarm[lr]$/, /^bicep[lr]$/],
  fore: [/(left|right)forearm$/, /^bip0?01[lr]forearm$/, /^[lr]elbow\d?$/, /^lowerarm[lr]$/, /^elbow[lr]$/],
  hand: [/(left|right)hand$/, /^bip0?01[lr]hand$/, /^[lr]wrist\d?$/, /^hand[lr]$/],
  thigh: [/(left|right)upleg$/, /^bip0?01[lr]thigh$/, /^[lr]leg\d?$/, /^upperleg[lr]$/, /^hip[lr]$/],
  shin: [/(left|right)leg$/, /^bip0?01[lr]calf$/, /^[lr]knee\d?$/, /^lowerleg[lr]$/, /^knee[lr]$/],
  foot: [/(left|right)foot$/, /^bip0?01[lr]foot$/, /^[lr]ank?le\d?$/, /^foot[lr]$/, /^shin[lr]$/],
};

export function canonicalBone(name: string): string {
  return name.toLowerCase().replace(/_\d+$/, "").replace(/[\s_.:-]/g, "");
}

export interface Pose {
  armL: THREE.Vector3; foreL: THREE.Vector3; armR: THREE.Vector3; foreR: THREE.Vector3;
  thighL: THREE.Vector3; shinL: THREE.Vector3; thighR: THREE.Vector3; shinR: THREE.Vector3;
  weapon: THREE.Vector3;
  lean: number; twist: number; roll: number; nod: number; turn: number; drop: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

export function blankPose(): Pose {
  return {
    armL: v(0.22, -1, 0.05), foreL: v(0.12, -0.9, 0.35), armR: v(-0.22, -1, 0.05), foreR: v(-0.1, -0.7, 0.7),
    thighL: v(0.08, -1, 0.02), shinL: v(0.05, -1, -0.04), thighR: v(-0.08, -1, 0.02), shinR: v(-0.05, -1, -0.04),
    weapon: v(0, 0.55, 0.85), lean: 0.05, twist: 0, roll: 0, nod: 0, turn: 0, drop: 0,
  };
}

const VEC_KEYS = ["armL", "foreL", "armR", "foreR", "thighL", "shinL", "thighR", "shinR", "weapon"] as const;
const NUM_KEYS = ["lean", "twist", "roll", "nod", "turn", "drop"] as const;

export function easePose(into: Pose, toward: Pose, k: number): void {
  VEC_KEYS.forEach((key) => into[key].lerp(toward[key], k).normalize());
  NUM_KEYS.forEach((key) => {
    into[key] += (toward[key] - into[key]) * k;
  });
}

interface Limb {
  bone: THREE.Bone;
  end: THREE.Object3D;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _wq = new THREE.Quaternion();
const _e = new THREE.Euler();

export class HumanRig {
  readonly ok: boolean;
  private readonly bones = new Map<Slot, THREE.Bone>();
  private readonly rest = new Map<THREE.Bone, THREE.Quaternion>();
  private readonly limbs: Partial<Record<"armL" | "foreL" | "armR" | "foreR" | "thighL" | "shinL" | "thighR" | "shinR", Limb>> = {};
  private restFoot = 0;
  private readonly frame: THREE.Object3D;

  // `frame` is the node whose local axes are the character space (it already carries the
  // facing correction), `pivot` is moved to keep feet planted.
  constructor(frame: THREE.Object3D, private readonly pivot: THREE.Object3D) {
    this.frame = frame;
    const all: THREE.Bone[] = [];
    frame.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) all.push(obj as THREE.Bone);
    });
    frame.updateMatrixWorld(true);
    const local = (obj: THREE.Object3D) => {
      obj.getWorldPosition(_a);
      return this.frame.worldToLocal(_a.clone());
    };
    const pick = (key: string): THREE.Bone[] => {
      for (const pattern of PATTERNS[key] ?? []) {
        const hits = all.filter((bone) => pattern.test(canonicalBone(bone.name)));
        if (hits.length) return hits;
      }
      return [];
    };
    const single = (slot: Slot, key: string) => {
      const hit = pick(key)[0];
      if (hit) this.bones.set(slot, hit);
    };
    single("hips", "hips");
    single("spine", "spine");
    single("chest", "chest");
    single("neck", "neck");
    single("head", "head");
    const pair = (key: string, left: Slot, right: Slot) => {
      const hits = pick(key);
      if (hits.length < 2) return;
      const sorted = hits.slice(0, 4).sort((p, q) => local(q).x - local(p).x);
      this.bones.set(left, sorted[0]!);
      this.bones.set(right, sorted[sorted.length - 1]!);
    };
    pair("arm", "armL", "armR");
    pair("fore", "foreL", "foreR");
    pair("hand", "handL", "handR");
    pair("thigh", "thighL", "thighR");
    pair("shin", "shinL", "shinR");
    pair("foot", "footL", "footR");
    all.forEach((bone) => this.rest.set(bone, bone.quaternion.clone()));
    const limb = (slot: keyof HumanRig["limbs"], endSlot: Slot) => {
      const bone = this.bones.get(slot);
      const end = this.bones.get(endSlot);
      if (bone && end && bone !== end) this.limbs[slot] = { bone, end };
    };
    limb("armL", "foreL");
    limb("foreL", "handL");
    limb("armR", "foreR");
    limb("foreR", "handR");
    limb("thighL", "shinL");
    limb("shinL", "footL");
    limb("thighR", "shinR");
    limb("shinR", "footR");
    this.ok = Boolean(this.limbs.armR && this.limbs.thighL && this.limbs.thighR);
    this.restFoot = this.footHeight();
  }

  bone(slot: Slot): THREE.Bone | undefined {
    return this.bones.get(slot);
  }

  // Character-space transform of the right hand, after the latest apply().
  hand(side: Side, position: THREE.Vector3): boolean {
    const hand = this.bones.get(side === "r" ? "handR" : "handL") ?? this.bones.get(side === "r" ? "foreR" : "foreL");
    if (!hand) return false;
    hand.getWorldPosition(position);
    this.frame.worldToLocal(position);
    return true;
  }

  private footHeight(): number {
    const feet = [this.bones.get("footL"), this.bones.get("footR")].filter(Boolean) as THREE.Bone[];
    if (!feet.length) return 0;
    let low = Infinity;
    feet.forEach((foot) => {
      foot.getWorldPosition(_a);
      this.frame.worldToLocal(_a);
      low = Math.min(low, _a.y);
    });
    return low;
  }

  private aim(limb: Limb | undefined, target: THREE.Vector3): void {
    if (!limb) return;
    const { bone, end } = limb;
    bone.updateWorldMatrix(true, false);
    end.updateWorldMatrix(false, false);
    bone.getWorldPosition(_a);
    end.getWorldPosition(_b);
    _b.sub(_a).normalize();
    this.frame.getWorldQuaternion(_wq);
    _a.copy(target).applyQuaternion(_wq);
    _q.setFromUnitVectors(_b, _a);
    this.rotateWorld(bone, _q);
  }

  private bend(slot: Slot, euler: THREE.Euler): void {
    const bone = this.bones.get(slot);
    if (!bone) return;
    bone.updateWorldMatrix(true, false);
    this.frame.getWorldQuaternion(_wq);
    _q.setFromEuler(euler);
    _q.premultiply(_wq).multiply(_q2.copy(_wq).invert());
    this.rotateWorld(bone, _q);
  }

  private rotateWorld(bone: THREE.Bone, delta: THREE.Quaternion): void {
    bone.getWorldQuaternion(_q2);
    _q2.premultiply(delta);
    if (bone.parent) {
      bone.parent.getWorldQuaternion(_pq);
      _q2.premultiply(_pq.invert());
    }
    bone.quaternion.copy(_q2);
    bone.updateMatrixWorld(true);
  }

  apply(pose: Pose): void {
    this.rest.forEach((quaternion, bone) => bone.quaternion.copy(quaternion));
    this.pivot.position.y = 0;
    this.frame.updateMatrixWorld(true);
    this.bend("hips", _e.set(0, pose.turn, pose.roll * 0.5));
    this.bend("spine", _e.set(pose.lean * 0.5, pose.twist * 0.5, pose.roll * 0.5));
    this.bend("chest", _e.set(pose.lean * 0.5, pose.twist * 0.5, 0));
    this.bend("head", _e.set(pose.nod - pose.lean * 0.6, -pose.twist * 0.4, 0));
    this.aim(this.limbs.thighL, pose.thighL);
    this.aim(this.limbs.shinL, pose.shinL);
    this.aim(this.limbs.thighR, pose.thighR);
    this.aim(this.limbs.shinR, pose.shinR);
    this.aim(this.limbs.armL, pose.armL);
    this.aim(this.limbs.foreL, pose.foreL);
    this.aim(this.limbs.armR, pose.armR);
    this.aim(this.limbs.foreR, pose.foreR);
    // Keep the lower foot on the ground, then add any deliberate crouch.
    const foot = this.footHeight();
    this.pivot.position.y = (this.restFoot - foot) * this.pivot.scale.y - pose.drop;
  }
}

// Pose library ------------------------------------------------------------------------

export type Style = "slash" | "thrust" | "bolt" | "maul" | "claw";

function arc(t: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}
const smooth = (t: number) => t * t * (3 - 2 * t);

export function stance(out: Pose, style: Style, time: number, run: number, phase: number): void {
  const b = blankPose();
  const breath = Math.sin(time * 1.9) * 0.03;
  b.armL.set(0.28, -1, 0.12 + breath).normalize();
  b.foreL.set(0.18, -0.75, 0.6).normalize();
  if (style === "bolt") {
    // Staff planted at the side, head beside the shoulder rather than across the face.
    b.armR.set(-0.42, -1, 0.08).normalize();
    b.foreR.set(-0.3, -0.75, 0.6).normalize();
    b.weapon.set(-0.12, 1, 0.08).normalize();
  } else if (style === "thrust") {
    b.armR.set(-0.35, -1, 0.15).normalize();
    b.foreR.set(-0.2, -0.45, 1).normalize();
    b.armL.set(0.2, -1, 0.3).normalize();
    b.foreL.set(-0.2, -0.2, 1).normalize();
    b.weapon.set(-0.12, 0.8, 0.6).normalize();
  } else if (style === "maul") {
    b.armR.set(-0.25, -1, 0.3).normalize();
    b.foreR.set(0.1, -0.35, 1).normalize();
    b.armL.set(0.25, -1, 0.3).normalize();
    b.foreL.set(-0.25, -0.3, 1).normalize();
    b.weapon.set(-0.25, 0.9, 0.3).normalize();
  } else if (style === "claw") {
    b.armR.set(-0.5, -1, 0.35).normalize();
    b.foreR.set(-0.3, -0.5, 1).normalize();
    b.armL.set(0.5, -1, 0.35).normalize();
    b.foreL.set(0.3, -0.5, 1).normalize();
    b.lean = 0.3;
  } else {
    b.armR.set(-0.3, -1, 0.2).normalize();
    b.foreR.set(-0.15, -0.35, 1).normalize();
    b.weapon.set(-0.2, 0.75, 0.65).normalize();
  }
  b.lean += breath * 0.5;
  if (run > 0.01) {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const swing = 0.75 * run;
    const legL = s * swing;
    const legR = -s * swing;
    const kneeL = Math.max(0, -c) * 1.2 * run + 0.15 * run;
    const kneeR = Math.max(0, c) * 1.2 * run + 0.15 * run;
    b.thighL.set(0.08, -Math.cos(legL), Math.sin(legL)).normalize();
    b.thighR.set(-0.08, -Math.cos(legR), Math.sin(legR)).normalize();
    b.shinL.set(0.05, -Math.cos(legL - kneeL), Math.sin(legL - kneeL)).normalize();
    b.shinR.set(-0.05, -Math.cos(legR - kneeR), Math.sin(legR - kneeR)).normalize();
    const armSwing = 0.55 * run;
    b.armL.lerp(_b.set(0.22, -Math.cos(-legL * 0.8), Math.sin(-legL * 0.8)), 0.6 * run).normalize();
    if (style === "slash" || style === "claw") {
      b.armR.lerp(_b.set(-0.22, -Math.cos(legL * armSwing), Math.sin(legL * armSwing) + 0.2), 0.5 * run).normalize();
    }
    b.lean += 0.22 * run;
    b.twist += s * 0.12 * run;
    b.drop += Math.abs(c) * 0.06 * run;
  }
  copyPose(out, b);
}

export function action(out: Pose, style: Style, name: string, age: number): number {
  // Returns how strongly the action overrides the locomotion stance (0..1).
  if (name === "attack" || name === "heavy") {
    const heavy = name === "heavy";
    const len = heavy ? 0.62 : 0.4;
    const t = age / len;
    if (t >= 1) return 0;
    const wind = smooth(arc(t, 0, 0.38));
    const hit = smooth(arc(t, 0.38, 0.62));
    const weight = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
    if (style === "bolt") {
      out.armR.set(-0.2, 0.05 + wind * 0.2, 1).normalize();
      out.foreR.set(-0.05, 0.2 + wind * 0.4 - hit * 0.3, 1).normalize();
      out.weapon.set(0, 1 - hit * 0.6, 0.3 + hit * 0.9).normalize();
      out.lean = 0.15 + hit * 0.1;
      out.twist = -0.3 + hit * 0.4;
    } else if (style === "thrust") {
      out.armR.set(-0.25, -0.4 + hit * 0.4, 0.4 + hit * 0.9).normalize();
      out.foreR.set(-0.05, -0.1, 1).normalize();
      out.armL.set(0.05, -0.3, 1).normalize();
      out.foreL.set(-0.4, 0, 1).normalize();
      out.weapon.set(-0.05, 0.12 - hit * 0.1, 1).normalize();
      out.lean = 0.12 + hit * 0.25 - wind * 0.1;
      out.twist = 0.35 * wind - 0.4 * hit;
    } else if (style === "claw") {
      const side = heavy ? 1 : 1;
      out.armR.set(-0.7 + hit * 1.1, 0.6 - hit * 1.2, -0.2 + hit * 1.2).normalize();
      out.foreR.set(-0.3 + hit * 0.9, 0.7 - hit * 1.2, 0.3 + hit).normalize();
      out.armL.set(0.7 * side - hit * 0.5, 0.4 - hit * 0.6, 0.3 + hit * 0.6).normalize();
      out.lean = 0.25 + hit * 0.35 - wind * 0.15;
      out.twist = 0.5 * wind - 0.6 * hit;
    } else {
      // Slash and maul: raise across the body, then cut down through the target.
      const up = heavy || style === "maul";
      out.armR.set(-0.75 + hit * 1.05, (up ? 0.85 : 0.45) * (1 - hit) - hit * 0.45, -0.35 + hit * 1.25).normalize();
      out.foreR.set(-0.35 + hit * 0.95, (up ? 1 : 0.7) * (1 - hit) - hit * 0.5, -0.1 + hit * 1.1).normalize();
      if (up) {
        out.armL.set(0.2 - hit * 0.4, 0.8 * (1 - hit) - hit * 0.4, 0.1 + hit * 1).normalize();
        out.foreL.set(-0.4, 0.9 * (1 - hit) - hit * 0.5, 0.3 + hit).normalize();
      }
      out.weapon.set(-0.4 + hit * 1.2, (up ? 1 : 0.6) * (1 - hit) - hit * 0.55, -0.6 + hit * 1.45).normalize();
      out.lean = -0.08 * wind + (up ? 0.5 : 0.3) * hit;
      out.twist = 0.55 * wind - 0.75 * hit;
      out.drop = hit * (up ? 0.12 : 0.05);
      out.thighL.set(0.12, -1, 0.35 * hit).normalize();
      out.thighR.set(-0.12, -1, -0.3 * hit).normalize();
      out.shinL.set(0.06, -1, -0.15 * hit).normalize();
    }
    return weight;
  }
  if (name === "cast") {
    const t = age / 0.5;
    if (t >= 1) return 0;
    const lift = smooth(arc(t, 0, 0.35));
    out.armL.set(0.45, 0.2 + lift * 0.5, 0.9).normalize();
    out.foreL.set(0.15, 0.4 + lift * 0.5, 1).normalize();
    out.armR.set(-0.45, 0.2 + lift * 0.5, 0.9).normalize();
    out.foreR.set(-0.15, 0.4 + lift * 0.5, 1).normalize();
    out.weapon.set(0, 1, 0.2).normalize();
    out.lean = -0.15 * lift;
    out.nod = -0.15 * lift;
    return t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
  }
  if (name === "dash") {
    const t = age / 0.4;
    if (t >= 1) return 0;
    out.lean = 0.7;
    out.drop = 0.25;
    out.thighL.set(0.1, -0.7, 0.8).normalize();
    out.shinL.set(0.05, -1, 0.1).normalize();
    out.thighR.set(-0.1, -0.9, -0.5).normalize();
    out.shinR.set(-0.05, -0.4, -1).normalize();
    out.armL.set(0.5, -0.6, -0.6).normalize();
    out.armR.set(-0.5, -0.6, -0.6).normalize();
    return Math.sin(Math.min(1, t) * Math.PI);
  }
  if (name === "hit") {
    const t = age / 0.3;
    if (t >= 1) return 0;
    out.lean = -0.35;
    out.nod = 0.3;
    out.roll = 0.15;
    out.armL.set(0.7, -0.5, -0.2).normalize();
    out.armR.set(-0.7, -0.5, -0.2).normalize();
    return Math.sin(Math.min(1, t) * Math.PI);
  }
  return 0;
}

export function copyPose(into: Pose, from: Pose): void {
  VEC_KEYS.forEach((key) => into[key].copy(from[key]));
  NUM_KEYS.forEach((key) => {
    into[key] = from[key];
  });
}

export function mixPose(into: Pose, over: Pose, k: number): void {
  if (k <= 0) return;
  VEC_KEYS.forEach((key) => into[key].lerp(over[key], k).normalize());
  NUM_KEYS.forEach((key) => {
    into[key] += (over[key] - into[key]) * k;
  });
}
