import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Civilization } from '../simulation/types';

export type RigState = 'idle' | 'move' | 'attack' | 'attack2' | 'heavy' | 'cast' | 'hit' | 'summon' | 'dash' | 'guard';
export type ActorVariant = 'vanguard' | 'skirmisher' | 'brute' | 'mystic' | 'boss';

type WeaponKind = 'staff' | 'sword' | 'hammer' | 'spear' | 'glaive';

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
  weapon: THREE.Group;
  weaponTrail: THREE.Mesh;
  auraMaterial: THREE.MeshBasicMaterial;
  trailMaterial: THREE.MeshBasicMaterial;
  glowColor: THREE.Color;
  hitColor: THREE.Color;
  owned: THREE.Material[];
  phase: number;
  walkPhase: number;
  moveBlend: number;
  lastTime: number;
  player: boolean;
  boss: boolean;
  variant: ActorVariant;
  action: RigState;
  actionStart: number;
  actionUntil: number;
}

const bladeShape = new THREE.Shape()
  .moveTo(-.055, 0)
  .lineTo(.055, 0)
  .lineTo(.09, -.62)
  .lineTo(0, -.9)
  .lineTo(-.09, -.62)
  .closePath();

const glaiveShape = new THREE.Shape()
  .moveTo(0, 0)
  .bezierCurveTo(.22, -.08, .28, -.38, .12, -.62)
  .bezierCurveTo(.03, -.75, -.06, -.72, -.08, -.55)
  .lineTo(-.035, -.08)
  .closePath();

const GEO = {
  shadow: new THREE.CircleGeometry(.7, 40),
  aura: new THREE.RingGeometry(.54, .62, 64),
  hips: new RoundedBoxGeometry(.4, .22, .3, 3, .06),
  torso: new THREE.CapsuleGeometry(.255, .3, 6, 16),
  breastplate: new RoundedBoxGeometry(.49, .34, .22, 4, .065),
  abdomenPlate: new RoundedBoxGeometry(.35, .105, .22, 3, .035),
  belt: new THREE.TorusGeometry(.205, .035, 8, 20),
  shoulder: new THREE.SphereGeometry(.16, 18, 12, 0, Math.PI * 2, 0, Math.PI * .62),
  shoulderRim: new THREE.TorusGeometry(.14, .025, 7, 20, Math.PI),
  upperArm: new THREE.CapsuleGeometry(.07, .22, 5, 12),
  forearm: new THREE.CapsuleGeometry(.065, .2, 5, 12),
  bracer: new THREE.CylinderGeometry(.09, .07, .19, 12),
  hand: new THREE.SphereGeometry(.075, 14, 10),
  thigh: new THREE.CapsuleGeometry(.1, .25, 6, 12),
  shin: new THREE.CapsuleGeometry(.077, .25, 6, 12),
  greave: new THREE.CylinderGeometry(.105, .08, .27, 12, 1, false, 0, Math.PI),
  foot: new RoundedBoxGeometry(.15, .095, .27, 3, .035),
  skull: new THREE.SphereGeometry(.17, 24, 16),
  jaw: new RoundedBoxGeometry(.2, .12, .17, 3, .04),
  eye: new THREE.SphereGeometry(.018, 8, 6),
  mask: new THREE.ConeGeometry(.15, .2, 6, 1, true, 0, Math.PI),
  hood: new THREE.SphereGeometry(.22, 20, 14, 0, Math.PI * 2, 0, Math.PI * .72),
  halo: new THREE.TorusGeometry(.25, .025, 8, 40),
  crownBand: new THREE.TorusGeometry(.18, .028, 8, 28),
  crownSpike: new THREE.ConeGeometry(.035, .2, 5),
  horn: new THREE.ConeGeometry(.055, .3, 8),
  cape: new THREE.PlaneGeometry(.68, 1.05, 8, 12),
  tabard: new THREE.PlaneGeometry(.3, .7, 2, 6),
  skirtPanel: new RoundedBoxGeometry(.21, .55, .055, 3, .025),
  shield: new THREE.CylinderGeometry(.35, .35, .075, 20),
  shieldRim: new THREE.TorusGeometry(.35, .035, 8, 28),
  buckler: new THREE.SphereGeometry(.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5),
  staffShaft: new THREE.CylinderGeometry(.025, .032, 1.55, 12),
  weaponGrip: new THREE.CylinderGeometry(.032, .035, .26, 12),
  gem: new THREE.OctahedronGeometry(.13, 1),
  blade: new THREE.ExtrudeGeometry(bladeShape, { depth: .035, bevelEnabled: true, bevelSegments: 2, bevelSize: .018, bevelThickness: .014 }),
  glaiveBlade: new THREE.ExtrudeGeometry(glaiveShape, { depth: .038, bevelEnabled: true, bevelSegments: 2, bevelSize: .015, bevelThickness: .012 }),
  swordGuard: new RoundedBoxGeometry(.28, .05, .07, 3, .02),
  hammerShaft: new THREE.CylinderGeometry(.032, .038, 1.05, 12),
  hammerHead: new RoundedBoxGeometry(.42, .24, .24, 5, .07),
  hammerBeak: new THREE.ConeGeometry(.1, .28, 8),
  spearShaft: new THREE.CylinderGeometry(.024, .032, 1.75, 12),
  spearTip: new THREE.ConeGeometry(.095, .4, 8),
  weaponTrail: new THREE.RingGeometry(.38, 1.18, 56, 1, -.6, 1.2),
};

GEO.blade.translate(0, 0, -.0175);
GEO.glaiveBlade.translate(0, 0, -.019);

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function paletteMaterials(civ: Civilization, hostile: boolean): {
  armor: THREE.MeshPhysicalMaterial;
  edge: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  owned: THREE.Material[];
} {
  const primary = new THREE.Color(civ.palette.primary);
  const glowColor = new THREE.Color(civ.palette.glow);
  const armor = new THREE.MeshPhysicalMaterial({
    color: primary.clone().lerp(new THREE.Color('#d9d1bd'), hostile ? .05 : .15),
    metalness: .82,
    roughness: .25,
    clearcoat: .32,
    clearcoatRoughness: .22,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: glowColor.clone().lerp(new THREE.Color('#fff1c1'), .28),
    metalness: .92,
    roughness: .18,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: primary.clone().multiplyScalar(hostile ? .42 : .58),
    roughness: .86,
    side: THREE.DoubleSide,
  });
  const leather = new THREE.MeshStandardMaterial({ color: '#211914', roughness: .82, metalness: .08 });
  const dark = new THREE.MeshStandardMaterial({ color: hostile ? '#080a10' : '#11131c', roughness: .62, metalness: .38 });
  const skin = new THREE.MeshStandardMaterial({
    color: ['#6b3f2f', '#9b6750', '#c18a69', '#7f4d3d', '#d2a17e'][civ.index % 5],
    roughness: .78,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: hostile ? 1.45 : 2.1,
    metalness: .65,
    roughness: .16,
  });
  return { armor, edge, cloth, leather, glow, skin, dark, owned: [armor, edge, cloth, leather, dark, skin, glow] };
}

function weaponKind(name: string): WeaponKind {
  if (/hammer|maul|mace/i.test(name)) return 'hammer';
  if (/staff|rod|sceptre|scepter|baton/i.test(name)) return 'staff';
  if (/spear|lance/i.test(name)) return 'spear';
  if (/glaive|scimitar|sabre/i.test(name)) return 'glaive';
  return 'sword';
}

function buildWeapon(kind: WeaponKind, materials: ReturnType<typeof paletteMaterials>): THREE.Group {
  const weapon = new THREE.Group();
  const { armor, edge, leather, glow } = materials;
  if (kind === 'staff') {
    weapon.add(part(GEO.staffShaft, leather, 0, -.62, 0));
    weapon.add(part(GEO.gem, glow, 0, -1.45, 0, [1, 1.25, 1]));
    const cage = part(GEO.halo, edge, 0, -1.45, 0, [.55, .55, .55], [Math.PI / 2, 0, 0]);
    weapon.add(cage);
  } else if (kind === 'sword') {
    weapon.add(part(GEO.weaponGrip, leather, 0, -.1, 0));
    weapon.add(part(GEO.swordGuard, edge, 0, -.23, 0));
    weapon.add(part(GEO.blade, edge, 0, -.25, 0));
    weapon.add(part(GEO.gem, glow, 0, -.2, .045, [.32, .32, .32]));
  } else if (kind === 'glaive') {
    weapon.add(part(GEO.spearShaft, leather, 0, -.72, 0, [1, .72, 1]));
    weapon.add(part(GEO.glaiveBlade, edge, 0, -1.25, 0));
    weapon.add(part(GEO.gem, glow, 0, -1.18, .045, [.35, .35, .35]));
  } else if (kind === 'hammer') {
    weapon.add(part(GEO.hammerShaft, leather, 0, -.52, 0));
    weapon.add(part(GEO.hammerHead, armor, 0, -1.07, 0));
    weapon.add(part(GEO.hammerBeak, edge, .32, -1.07, 0, [1, 1, 1], [0, 0, -Math.PI / 2]));
    weapon.add(part(GEO.gem, glow, 0, -1.07, .13, [.55, .55, .55]));
  } else {
    weapon.add(part(GEO.spearShaft, leather, 0, -.76, 0));
    weapon.add(part(GEO.spearTip, edge, 0, -1.77, 0));
    weapon.add(part(GEO.gem, glow, 0, -1.54, 0, [.42, .42, .42]));
  }
  return weapon;
}

function addHeadgear(head: THREE.Group, civ: Civilization, materials: ReturnType<typeof paletteMaterials>, boss: boolean): void {
  const style = civ.index % 5;
  const { armor, edge, cloth, glow, dark } = materials;
  if (style === 0) {
    head.add(part(GEO.hood, cloth, 0, .08, -.01, [1.08, 1.04, 1.08]));
    const mask = part(GEO.mask, armor, 0, .015, .16, [1, .8, 1], [Math.PI / 2, 0, 0]);
    head.add(mask);
  } else if (style === 1) {
    const band = part(GEO.crownBand, edge, 0, .17, 0, [1, 1, 1], [Math.PI / 2, 0, 0]);
    head.add(band);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      head.add(part(GEO.crownSpike, i === 0 ? glow : edge, Math.sin(angle) * .15, .26, Math.cos(angle) * .15, [1, .72 + (i === 0 ? .5 : 0), 1], [0, 0, Math.sin(angle) * .22]));
    }
  } else if (style === 2) {
    head.add(part(GEO.hood, armor, 0, .08, -.02, [1.05, .78, 1.08]));
    head.add(part(GEO.horn, edge, -.16, .21, -.02, [1, 1, 1], [0, 0, .55]));
    head.add(part(GEO.horn, edge, .16, .21, -.02, [1, 1, 1], [0, 0, -.55]));
  } else if (style === 3) {
    const halo = part(GEO.halo, glow, 0, .14, -.12, [1, 1, 1], [0, 0, 0]);
    head.add(halo);
    head.add(part(GEO.horn, dark, 0, .3, -.04, [.9, 1.25, .9], [0, 0, 0]));
  } else {
    head.add(part(GEO.hood, cloth, 0, .07, -.03, [1.12, 1.08, 1.12]));
    head.add(part(GEO.crownBand, edge, 0, .14, 0, [1.12, 1.12, 1.12], [Math.PI / 2, 0, 0]));
  }
  if (boss) {
    const halo = part(GEO.halo, glow, 0, .32, -.08, [1.3, 1.3, 1.3], [0, 0, 0]);
    head.add(halo);
  }
}

function addShield(elbow: THREE.Group, materials: ReturnType<typeof paletteMaterials>, variant: ActorVariant): void {
  if (variant === 'skirmisher' || variant === 'mystic') return;
  const scale = variant === 'brute' || variant === 'boss' ? 1.18 : .9;
  const shield = new THREE.Group();
  shield.add(part(GEO.shield, materials.armor, 0, 0, 0, [scale, scale, scale], [0, 0, Math.PI / 2]));
  shield.add(part(GEO.shieldRim, materials.edge, -.042, 0, 0, [scale, scale, scale], [0, Math.PI / 2, 0]));
  shield.add(part(GEO.buckler, materials.glow, -.07, 0, 0, [scale, scale, scale], [0, 0, -Math.PI / 2]));
  shield.position.set(-.09, -.22, .08);
  shield.rotation.set(0, 0, -.14);
  elbow.add(shield);
}

export function createRiggedActor(
  civ: Civilization,
  player: boolean,
  boss = false,
  variant: ActorVariant = boss ? 'boss' : 'vanguard',
): THREE.Group {
  const root = new THREE.Group();
  const materials = paletteMaterials(civ, !player);
  const { armor, edge, cloth, leather, glow, skin, dark } = materials;

  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: boss ? .48 : .34, depthWrite: false });
  const shadow = new THREE.Mesh(GEO.shadow, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .018;
  root.add(shadow);

  const auraMaterial = new THREE.MeshBasicMaterial({
    color: civ.palette.glow,
    transparent: true,
    opacity: .32,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const aura = new THREE.Mesh(GEO.aura, auraMaterial);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = .035;
  root.add(aura);

  const figure = new THREE.Group();
  root.add(figure);
  const pelvis = new THREE.Group();
  pelvis.position.y = 1;
  figure.add(pelvis);
  pelvis.add(part(GEO.hips, dark, 0, -.02, 0));
  pelvis.add(part(GEO.belt, edge, 0, .08, 0, [1, 1, 1], [Math.PI / 2, 0, 0]));

  [-1, 1].forEach((side) => {
    pelvis.add(part(GEO.skirtPanel, cloth, .13 * side, -.35, -.01, [1, 1, 1], [side * .04, 0, side * .05]));
  });
  pelvis.add(part(GEO.tabard, cloth, 0, -.3, .16, [1, 1, 1], [0, 0, 0]));

  const makeLeg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(.135 * side, -.09, 0);
    hip.add(part(GEO.thigh, dark, 0, -.22, 0));
    const knee = new THREE.Group();
    knee.position.y = -.45;
    knee.add(part(GEO.shin, dark, 0, -.2, 0));
    knee.add(part(GEO.greave, armor, 0, -.17, -.04, [1, 1, 1], [0, side > 0 ? Math.PI : 0, 0]));
    knee.add(part(GEO.foot, leather, 0, -.43, .075));
    hip.add(knee);
    pelvis.add(hip);
    return { hip, knee };
  };
  const left = makeLeg(-1);
  const right = makeLeg(1);

  const spine = new THREE.Group();
  spine.position.y = .12;
  pelvis.add(spine);
  spine.add(part(GEO.torso, dark, 0, .29, 0, [1, 1.12, .9]));
  spine.add(part(GEO.breastplate, armor, 0, .34, .055));
  spine.add(part(GEO.abdomenPlate, edge, 0, .12, .08));
  spine.add(part(GEO.abdomenPlate, armor, 0, .02, .07, [.92, .92, .92]));
  spine.add(part(GEO.shoulder, armor, -.31, .48, 0, [1.18, .88, 1.05], [0, 0, .18]));
  spine.add(part(GEO.shoulder, armor, .31, .48, 0, [1.18, .88, 1.05], [0, 0, -.18]));
  spine.add(part(GEO.shoulderRim, edge, -.31, .47, .015, [1.08, 1.08, 1.08], [Math.PI / 2, 0, -Math.PI / 2]));
  spine.add(part(GEO.shoulderRim, edge, .31, .47, .015, [1.08, 1.08, 1.08], [Math.PI / 2, 0, Math.PI / 2]));

  const cape = new THREE.Mesh(GEO.cape, cloth);
  cape.position.set(0, .37, -.19);
  cape.rotation.x = .18;
  cape.castShadow = true;
  spine.add(cape);

  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(.34 * side, .43, 0);
    arm.add(part(GEO.upperArm, dark, 0, -.18, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -.37;
    elbow.add(part(GEO.forearm, dark, 0, -.16, 0));
    elbow.add(part(GEO.bracer, armor, 0, -.18, 0));
    elbow.add(part(GEO.hand, skin, 0, -.35, 0));
    arm.add(elbow);
    spine.add(arm);
    return { arm, elbow };
  };
  const armLeft = makeArm(-1);
  const armRight = makeArm(1);

  const weapon = buildWeapon(weaponKind(civ.weapon), materials);
  weapon.position.set(0, -.35, .025);
  weapon.rotation.z = -.03;
  armRight.elbow.add(weapon);
  addShield(armLeft.elbow, materials, variant);

  const trailMaterial = new THREE.MeshBasicMaterial({
    color: civ.palette.glow,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const weaponTrail = new THREE.Mesh(GEO.weaponTrail, trailMaterial);
  weaponTrail.position.set(0, -.66, 0);
  weaponTrail.rotation.set(0, Math.PI / 2, 0);
  weapon.add(weaponTrail);

  const head = new THREE.Group();
  head.position.y = .69;
  head.add(part(GEO.skull, skin, 0, .04, 0, [1, 1.08, .95]));
  head.add(part(GEO.jaw, skin, 0, -.045, .065));
  head.add(part(GEO.eye, glow, -.06, .07, .155, [1, .72, .65]));
  head.add(part(GEO.eye, glow, .06, .07, .155, [1, .72, .65]));
  addHeadgear(head, civ, materials, boss);
  spine.add(head);

  const bodyScale = variant === 'skirmisher' ? [.88, .98, .88] : variant === 'brute' ? [1.2, 1.08, 1.18] : variant === 'mystic' ? [.94, 1.07, .94] : [1, 1, 1];
  figure.scale.set(bodyScale[0], bodyScale[1], bodyScale[2]);
  if (player) root.scale.setScalar(1.18);
  if (boss) root.scale.setScalar(1.62);

  const rig: Rig = {
    figure,
    pelvis,
    spine,
    head,
    armL: armLeft.arm,
    armR: armRight.arm,
    elbowL: armLeft.elbow,
    elbowR: armRight.elbow,
    legL: left.hip,
    legR: right.hip,
    kneeL: left.knee,
    kneeR: right.knee,
    cape,
    aura,
    weapon,
    weaponTrail,
    auraMaterial,
    trailMaterial,
    glowColor: new THREE.Color(civ.palette.glow),
    hitColor: new THREE.Color('#ff3b4f'),
    owned: [...materials.owned, shadowMaterial, auraMaterial, trailMaterial],
    phase: Math.random() * Math.PI * 2,
    walkPhase: Math.random() * Math.PI * 2,
    moveBlend: 0,
    lastTime: 0,
    player,
    boss,
    variant,
    action: 'idle',
    actionStart: 0,
    actionUntil: 0,
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
const easeInOut = (t: number) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function animateRig(actor: THREE.Group, time: number, movementSpeed = 0): void {
  const rig = actor.userData.rig as Rig | undefined;
  if (!rig) return;
  const dt = THREE.MathUtils.clamp(time - rig.lastTime, 0, .05);
  rig.lastTime = time;
  if (time > rig.actionUntil && !['idle', 'move'].includes(rig.action)) rig.action = 'idle';
  if (rig.action === 'idle' || rig.action === 'move') rig.action = movementSpeed > .2 ? 'move' : 'idle';

  const tempo = rig.boss ? .78 : rig.variant === 'skirmisher' ? 1.18 : rig.variant === 'brute' ? .88 : 1;
  rig.moveBlend += ((movementSpeed > .2 ? 1 : 0) - rig.moveBlend) * Math.min(1, dt * 11);
  if (rig.moveBlend > .02) rig.walkPhase += dt * (4.5 + movementSpeed * 1.55) * tempo;

  const blend = rig.moveBlend;
  const swing = Math.sin(rig.walkPhase) * blend;
  const swingB = Math.sin(rig.walkPhase + Math.PI) * blend;
  const breathe = Math.sin(time * (rig.boss ? 1.25 : 2) + rig.phase);

  rig.legL.rotation.set(swing * .68, 0, 0);
  rig.kneeL.rotation.set(Math.max(0, Math.sin(rig.walkPhase + .5)) * .88 * blend, 0, 0);
  rig.legR.rotation.set(swingB * .68, 0, 0);
  rig.kneeR.rotation.set(Math.max(0, Math.sin(rig.walkPhase + Math.PI + .5)) * .88 * blend, 0, 0);
  rig.armL.rotation.set(swingB * .42 + breathe * .025, 0, .12);
  rig.armR.rotation.set(swing * .38 + breathe * .025, 0, -.12);
  rig.elbowL.rotation.set(-.28 - Math.max(0, swingB) * .38, 0, 0);
  rig.elbowR.rotation.set(-.4 - Math.max(0, swing) * .3, 0, 0);
  rig.spine.rotation.set(-blend * .1 + breathe * .012, 0, swing * .05);
  rig.pelvis.rotation.set(0, swing * .075, 0);
  rig.head.rotation.set(blend * .05 + breathe * .016, 0, 0);
  rig.figure.position.set(0, Math.abs(Math.cos(rig.walkPhase)) * .055 * blend + breathe * .009, 0);
  rig.cape.rotation.x = .18 + blend * .5 + Math.sin(time * 2.5 + rig.phase) * .045;
  rig.trailMaterial.opacity = 0;

  const span = rig.actionUntil - rig.actionStart;
  const p = span > 0 ? THREE.MathUtils.clamp((time - rig.actionStart) / span, 0, 1) : 1;
  const fade = 1 - THREE.MathUtils.smoothstep(p, .86, 1);
  const amp = rig.boss ? 1.15 : 1;

  if (rig.action === 'attack' || rig.action === 'attack2') {
    const reverse = rig.action === 'attack2' ? -1 : 1;
    const wind = Math.min(1, p / .28);
    const release = Math.max(0, (p - .28) / .72);
    const slash = p < .28 ? easeOut(wind) : 1 - easeInOut(release);
    rig.armR.rotation.x = (-1.8 + slash * 3.15) * fade;
    rig.armR.rotation.z = reverse * (-.28 + slash * .42) * fade;
    rig.elbowR.rotation.x = (-.85 + slash * .42) * fade;
    rig.spine.rotation.y = reverse * (-.52 + easeInOut(p) * 1.05) * fade * amp;
    rig.pelvis.rotation.y = -rig.spine.rotation.y * .42;
    rig.trailMaterial.opacity = Math.sin(p * Math.PI) * .68;
  } else if (rig.action === 'heavy') {
    const wind = THREE.MathUtils.smoothstep(p, 0, .45);
    const slam = THREE.MathUtils.smoothstep(p, .45, .82);
    rig.armR.rotation.x = THREE.MathUtils.lerp(-2.75 * wind, 1.1, slam) * fade;
    rig.armL.rotation.x = THREE.MathUtils.lerp(-2.25 * wind, .65, slam) * fade;
    rig.elbowR.rotation.x = -.72 * fade;
    rig.spine.rotation.x = THREE.MathUtils.lerp(-.38 * wind, .5, slam) * fade;
    rig.figure.position.y += Math.sin(p * Math.PI) * .22 * amp;
    rig.trailMaterial.opacity = THREE.MathUtils.smoothstep(p, .35, .55) * (1 - THREE.MathUtils.smoothstep(p, .78, 1)) * .9;
  } else if (rig.action === 'cast') {
    const env = Math.sin(p * Math.PI);
    rig.armL.rotation.x = -2.35 * env;
    rig.armR.rotation.x = -2.35 * env;
    rig.armL.rotation.z = .55 * env;
    rig.armR.rotation.z = -.55 * env;
    rig.elbowL.rotation.x = -.25 * env;
    rig.elbowR.rotation.x = -.25 * env;
    rig.head.rotation.x = -.24 * env;
    rig.figure.position.y += env * .16 * amp;
  } else if (rig.action === 'summon') {
    const env = Math.sin(p * Math.PI);
    rig.armL.rotation.x = -1.08 * env;
    rig.armR.rotation.x = -1.08 * env;
    rig.armL.rotation.z = .12 + 1.25 * env;
    rig.armR.rotation.z = -.12 - 1.25 * env;
    rig.head.rotation.x = -.28 * env;
    rig.figure.position.y += env * .09;
  } else if (rig.action === 'hit') {
    const env = Math.sin(p * Math.PI);
    rig.spine.rotation.x += .46 * env;
    rig.head.rotation.x += .28 * env;
    rig.figure.position.z = -.15 * env;
  } else if (rig.action === 'dash') {
    const env = Math.sin(p * Math.PI);
    rig.spine.rotation.x = -.52 * env;
    rig.armL.rotation.x = .72 * env;
    rig.armR.rotation.x = -.85 * env;
    rig.cape.rotation.x += .85 * env;
    rig.figure.position.y -= .08 * env;
  } else if (rig.action === 'guard') {
    const env = Math.sin(p * Math.PI);
    rig.armL.rotation.x = -1.35 * env;
    rig.armL.rotation.z = .7 * env;
    rig.spine.rotation.x = .16 * env;
  } else {
    rig.figure.position.z = 0;
  }

  const casting = rig.action === 'cast' || rig.action === 'summon' ? Math.sin(p * Math.PI) : 0;
  const hurt = rig.action === 'hit' ? Math.sin(p * Math.PI) : 0;
  const heavy = rig.action === 'heavy' ? Math.sin(p * Math.PI) : 0;
  rig.auraMaterial.color.copy(hurt > .08 ? rig.hitColor : rig.glowColor);
  rig.auraMaterial.opacity = .2 + (breathe + 1) * .065 + casting * .38 + heavy * .18 + hurt * .35;
  rig.aura.scale.setScalar(1 + (breathe + 1) * .055 + casting * .52 + heavy * .22);
}

export function disposeActor(actor: THREE.Group): void {
  const rig = actor.userData.rig as Rig | undefined;
  rig?.owned.forEach((material) => material.dispose());
}
