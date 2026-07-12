import * as THREE from 'three';
import type { Civilization } from '../simulation/types';

export type RigState = 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'summon';

type WeaponKind = 'staff' | 'sword' | 'hammer' | 'spear';

interface Rig {
  figure: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  cape: THREE.Mesh;
  aura: THREE.Mesh;
  auraMaterial: THREE.MeshBasicMaterial;
  glowColor: THREE.Color;
  hitColor: THREE.Color;
  owned: THREE.Material[];
  phase: number;
  walkPhase: number;
  moveBlend: number;
  lastTime: number;
  player: boolean;
  boss: boolean;
  action: RigState;
  actionStart: number;
  actionUntil: number;
}

const GEO = {
  shadow: new THREE.CircleGeometry(.62, 22),
  aura: new THREE.RingGeometry(.5, .58, 40),
  hips: new THREE.BoxGeometry(.34, .2, .24),
  chest: new THREE.CylinderGeometry(.19, .27, .52, 8),
  collar: new THREE.CylinderGeometry(.21, .17, .12, 8),
  shoulder: new THREE.SphereGeometry(.115, 8, 6),
  upperArm: new THREE.CylinderGeometry(.07, .06, .34, 6),
  forearm: new THREE.CylinderGeometry(.06, .05, .3, 6),
  hand: new THREE.SphereGeometry(.07, 6, 5),
  thigh: new THREE.CylinderGeometry(.095, .075, .4, 6),
  shin: new THREE.CylinderGeometry(.07, .055, .38, 6),
  foot: new THREE.BoxGeometry(.12, .08, .23),
  skull: new THREE.IcosahedronGeometry(.165, 1),
  crown: new THREE.TorusGeometry(.165, .034, 5, 10),
  crownGem: new THREE.OctahedronGeometry(.055),
  cape: new THREE.PlaneGeometry(.56, .88),
  staffShaft: new THREE.CylinderGeometry(.028, .028, 1.45, 6),
  staffGem: new THREE.OctahedronGeometry(.115),
  swordGrip: new THREE.CylinderGeometry(.03, .03, .24, 6),
  swordGuard: new THREE.BoxGeometry(.2, .045, .055),
  swordBlade: new THREE.BoxGeometry(.055, .82, .018),
  hammerShaft: new THREE.CylinderGeometry(.032, .032, .95, 6),
  hammerHead: new THREE.BoxGeometry(.32, .17, .17),
  spearShaft: new THREE.CylinderGeometry(.024, .024, 1.7, 6),
  spearTip: new THREE.ConeGeometry(.06, .3, 5),
};
GEO.cape.translate(0, -.44, 0);

const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: '#02030a', transparent: true, opacity: .42, depthWrite: false });
const DARK_MAT = new THREE.MeshStandardMaterial({ color: '#191a22', roughness: .5, metalness: .55 });
const SKIN_MAT = new THREE.MeshStandardMaterial({ color: '#d2b39b', roughness: .75, metalness: .05 });

const paletteCache = new Map<string, { armor: THREE.MeshStandardMaterial; glow: THREE.MeshStandardMaterial; cape: THREE.MeshStandardMaterial }>();
function paletteMaterials(primary: string, glow: string) {
  const key = `${primary}|${glow}`;
  let entry = paletteCache.get(key);
  if (!entry) {
    entry = {
      armor: new THREE.MeshStandardMaterial({ color: primary, emissive: primary, emissiveIntensity: .16, roughness: .38, metalness: .58 }),
      glow: new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.35, roughness: .25, metalness: .6 }),
      cape: new THREE.MeshStandardMaterial({ color: primary, emissive: primary, emissiveIntensity: .1, roughness: .82, metalness: .12, side: THREE.DoubleSide }),
    };
    paletteCache.set(key, entry);
  }
  return entry;
}

function weaponKind(weapon: string): WeaponKind {
  const name = weapon.toLowerCase();
  if (/hammer|maul|mace/.test(name)) return 'hammer';
  if (/lance|spear/.test(name)) return 'spear';
  if (/blade|sabre|scimitar|sword|glaive/.test(name)) return 'sword';
  return 'staff';
}

function part(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function buildWeapon(kind: WeaponKind, armor: THREE.MeshStandardMaterial, glow: THREE.MeshStandardMaterial): THREE.Group {
  const weapon = new THREE.Group();
  if (kind === 'staff') {
    weapon.add(part(GEO.staffShaft, DARK_MAT, 0, .45, 0));
    weapon.add(part(GEO.staffGem, glow, 0, 1.22, 0));
  } else if (kind === 'sword') {
    weapon.add(part(GEO.swordGrip, DARK_MAT, 0, .02, 0));
    weapon.add(part(GEO.swordGuard, armor, 0, .15, 0));
    weapon.add(part(GEO.swordBlade, glow, 0, .58, 0));
  } else if (kind === 'hammer') {
    weapon.add(part(GEO.hammerShaft, DARK_MAT, 0, .32, 0));
    weapon.add(part(GEO.hammerHead, armor, 0, .82, 0));
    weapon.add(part(GEO.staffGem, glow, 0, .82, 0));
  } else {
    weapon.add(part(GEO.spearShaft, DARK_MAT, 0, .55, 0));
    weapon.add(part(GEO.spearTip, glow, 0, 1.5, 0));
  }
  return weapon;
}

export function createRiggedActor(civ: Civilization, player: boolean, boss = false): THREE.Group {
  const root = new THREE.Group();
  const { armor, glow, cape: capeMat } = paletteMaterials(civ.palette.primary, civ.palette.glow);

  const shadow = new THREE.Mesh(GEO.shadow, SHADOW_MAT);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .02;
  root.add(shadow);

  const auraMaterial = new THREE.MeshBasicMaterial({ color: civ.palette.glow, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false });
  const aura = new THREE.Mesh(GEO.aura, auraMaterial);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = .035;
  root.add(aura);

  const figure = new THREE.Group();
  root.add(figure);
  const pelvis = new THREE.Group();
  pelvis.position.y = .92;
  figure.add(pelvis);
  pelvis.add(part(GEO.hips, DARK_MAT, 0, -.02, 0));

  const makeLeg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(.13 * side, -.08, 0);
    hip.add(part(GEO.thigh, DARK_MAT, 0, -.2, 0));
    const knee = new THREE.Group();
    knee.position.y = -.42;
    knee.add(part(GEO.shin, DARK_MAT, 0, -.19, 0));
    knee.add(part(GEO.foot, DARK_MAT, 0, -.4, .05));
    hip.add(knee);
    pelvis.add(hip);
    return { hip, knee };
  };
  const left = makeLeg(-1);
  const right = makeLeg(1);

  const spine = new THREE.Group();
  spine.position.y = .1;
  pelvis.add(spine);
  spine.add(part(GEO.chest, armor, 0, .28, 0));
  spine.add(part(GEO.collar, DARK_MAT, 0, .54, 0));
  spine.add(part(GEO.shoulder, armor, -.27, .46, 0));
  spine.add(part(GEO.shoulder, armor, .27, .46, 0));

  const cape = new THREE.Mesh(GEO.cape, capeMat);
  cape.position.set(0, .48, -.18);
  cape.rotation.x = .2;
  spine.add(cape);

  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(.3 * side, .44, 0);
    arm.add(part(GEO.upperArm, armor, 0, -.17, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -.34;
    elbow.add(part(GEO.forearm, DARK_MAT, 0, -.15, 0));
    elbow.add(part(GEO.hand, SKIN_MAT, 0, -.3, 0));
    arm.add(elbow);
    spine.add(arm);
    return { arm, elbow };
  };
  const armLeft = makeArm(-1);
  const armRight = makeArm(1);

  const weapon = buildWeapon(weaponKind(civ.weapon), armor, glow);
  weapon.position.set(0, -.32, .02);
  armRight.elbow.add(weapon);

  const head = new THREE.Group();
  head.position.y = .64;
  head.add(part(GEO.skull, SKIN_MAT, 0, .06, 0));
  const crown = part(GEO.crown, glow, 0, .21, 0);
  crown.rotation.x = Math.PI / 2;
  head.add(crown);
  head.add(part(GEO.crownGem, glow, 0, .26, .1));
  spine.add(head);

  if (player) root.scale.setScalar(1.12);

  const rig: Rig = {
    figure, pelvis, spine, head,
    armL: armLeft.arm, armR: armRight.arm, elbowL: armLeft.elbow, elbowR: armRight.elbow,
    legL: left.hip, legR: right.hip, kneeL: left.knee, kneeR: right.knee,
    cape, aura, auraMaterial,
    glowColor: new THREE.Color(civ.palette.glow), hitColor: new THREE.Color('#ff5a56'),
    owned: [auraMaterial],
    phase: Math.random() * Math.PI * 2,
    walkPhase: Math.random() * Math.PI * 2,
    moveBlend: 0, lastTime: 0,
    player, boss, action: 'idle', actionStart: 0, actionUntil: 0,
  };
  root.userData.rig = rig;
  return root;
}

export function setRigState(actor: THREE.Group, action: RigState, time: number, duration = .32): void {
  const rig = actor.userData.rig as Rig | undefined;
  if (!rig) return;
  rig.action = action;
  rig.actionStart = time;
  rig.actionUntil = time + duration;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export function animateRig(actor: THREE.Group, time: number, movementSpeed = 0): void {
  const rig = actor.userData.rig as Rig | undefined;
  if (!rig) return;
  const dt = THREE.MathUtils.clamp(time - rig.lastTime, 0, .05);
  rig.lastTime = time;
  if (time > rig.actionUntil && rig.action !== 'idle' && rig.action !== 'move') rig.action = 'idle';
  if (rig.action === 'idle' || rig.action === 'move') rig.action = movementSpeed > .2 ? 'move' : 'idle';

  const tempo = rig.boss ? .72 : 1;
  rig.moveBlend += ((movementSpeed > .2 ? 1 : 0) - rig.moveBlend) * Math.min(1, dt * 10);
  if (rig.moveBlend > .02) rig.walkPhase += dt * (4.6 + movementSpeed * 1.7) * tempo;

  const blend = rig.moveBlend;
  const swing = Math.sin(rig.walkPhase) * blend;
  const swingB = Math.sin(rig.walkPhase + Math.PI) * blend;
  const breathe = Math.sin(time * (rig.boss ? 1.3 : 2.1) + rig.phase);

  // locomotion + idle base pose, rebuilt from scratch every frame
  rig.legL.rotation.set(swing * .72, 0, 0);
  rig.kneeL.rotation.set(Math.max(0, Math.sin(rig.walkPhase + .55)) * .95 * blend, 0, 0);
  rig.legR.rotation.set(swingB * .72, 0, 0);
  rig.kneeR.rotation.set(Math.max(0, Math.sin(rig.walkPhase + Math.PI + .55)) * .95 * blend, 0, 0);
  rig.armL.rotation.set(swingB * .5 + breathe * .03, 0, .16);
  rig.armR.rotation.set(swing * .5 + breathe * .03, 0, -.16);
  rig.elbowL.rotation.set(-.3 - Math.max(0, swingB) * .45, 0, 0);
  rig.elbowR.rotation.set(-.3 - Math.max(0, swing) * .45, 0, 0);
  rig.spine.rotation.set(-blend * .13 + breathe * .015, 0, swing * .05);
  rig.pelvis.rotation.set(0, swing * .09, 0);
  rig.head.rotation.set(blend * .07 + breathe * .02, 0, 0);
  rig.figure.position.set(0, Math.abs(Math.cos(rig.walkPhase)) * .07 * blend + breathe * .012, 0);
  rig.cape.rotation.x = .2 + blend * .55 + Math.sin(time * 2.7 + rig.phase) * .05;

  const span = rig.actionUntil - rig.actionStart;
  const p = span > 0 ? THREE.MathUtils.clamp((time - rig.actionStart) / span, 0, 1) : 1;
  const fade = 1 - THREE.MathUtils.smoothstep(p, .82, 1);
  const amp = rig.boss ? 1.2 : 1;

  if (rig.action === 'attack') {
    const raise = Math.min(1, p / .36);
    const angle = p < .36
      ? THREE.MathUtils.lerp(0, 2.35, easeOut(raise))
      : THREE.MathUtils.lerp(2.35, -1.05, easeOut((p - .36) / .64));
    rig.armR.rotation.x = angle * fade * amp;
    rig.elbowR.rotation.x = -(p < .36 ? 1.15 * raise : 1.15 * (1 - (p - .36) / .64)) * fade;
    rig.spine.rotation.y = (p < .36 ? -.42 * raise : THREE.MathUtils.lerp(-.42, .5, (p - .36) / .64)) * fade * amp;
  } else if (rig.action === 'cast') {
    const env = Math.sin(p * Math.PI);
    rig.armL.rotation.x = -2.45 * env;
    rig.armR.rotation.x = -2.45 * env;
    rig.elbowL.rotation.x = -.35 * env;
    rig.elbowR.rotation.x = -.35 * env;
    rig.head.rotation.x = -.3 * env;
    rig.figure.position.y += env * .17 * amp;
  } else if (rig.action === 'summon') {
    const env = Math.sin(p * Math.PI);
    rig.armL.rotation.x = -1.15 * env;
    rig.armR.rotation.x = -1.15 * env;
    rig.armL.rotation.z = .16 + 1.35 * env;
    rig.armR.rotation.z = -.16 - 1.35 * env;
    rig.head.rotation.x = -.32 * env;
    rig.figure.position.y += env * .1;
  } else if (rig.action === 'hit') {
    const env = Math.sin(p * Math.PI);
    rig.spine.rotation.x += .48 * env;
    rig.head.rotation.x += .3 * env;
    rig.figure.position.z = -.14 * env;
  } else {
    rig.figure.position.z = 0;
  }

  const casting = rig.action === 'cast' || rig.action === 'summon' ? Math.sin(p * Math.PI) : 0;
  const hurt = rig.action === 'hit' ? Math.sin(p * Math.PI) : 0;
  rig.auraMaterial.color.copy(hurt > .08 ? rig.hitColor : rig.glowColor);
  rig.auraMaterial.opacity = .26 + (breathe + 1) * .1 + casting * .35 + hurt * .3;
  rig.aura.scale.setScalar(1 + (breathe + 1) * .07 + casting * .45);
}

export function disposeActor(actor: THREE.Group): void {
  const rig = actor.userData.rig as Rig | undefined;
  rig?.owned.forEach((material) => material.dispose());
}
