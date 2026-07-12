import * as THREE from 'three';
import type { Civilization } from '../simulation/types';

const rulerAtlas = new THREE.TextureLoader().load('/assets/realm-rulers-atlas.png');
const propAtlas = new THREE.TextureLoader().load('/assets/realm-props-atlas.png');
rulerAtlas.colorSpace = THREE.SRGBColorSpace;
propAtlas.colorSpace = THREE.SRGBColorSpace;

function atlasTexture(source: THREE.Texture, index: number): THREE.Texture {
  const texture = source.clone();
  const col = index % 5;
  const row = Math.floor(index / 5);
  texture.repeat.set(.2, .25);
  texture.offset.set(col * .2, 1 - (row + 1) * .25);
  texture.needsUpdate = true;
  return texture;
}

export function createRiggedActor(civ: Civilization, player: boolean, boss = false): THREE.Group {
  const root = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(boss ? .86 : .58, 28), new THREE.MeshBasicMaterial({ color: '#02030a', transparent: true, opacity: .43, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .025;
  root.add(shadow);
  const pose = new THREE.Group();
  const material = new THREE.SpriteMaterial({ map: atlasTexture(rulerAtlas, civ.index - 1), transparent: true, depthWrite: false, alphaTest: .02, color: '#ffffff' });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(.5, 0);
  sprite.scale.set(boss ? 3.7 : player ? 3.15 : 2.48, boss ? 4.5 : player ? 3.85 : 3.05, 1);
  sprite.position.y = .02;
  pose.add(sprite);
  const aura = new THREE.Mesh(new THREE.RingGeometry(.46, .52, 48), new THREE.MeshBasicMaterial({ color: civ.palette.glow, transparent: true, opacity: .52, side: THREE.DoubleSide, depthWrite: false }));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = .035;
  root.add(aura);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: atlasTexture(propAtlas, (civ.index + 1) % 20), transparent: true, depthWrite: false, opacity: .23, color: civ.palette.glow }));
  halo.scale.set(2.8, 2.8, 1);
  halo.position.set(0, 2.05, -.12);
  pose.add(halo);
  root.add(pose);
  root.userData.rig = { pose, sprite, aura, halo, phase: Math.random() * Math.PI * 2, player, boss, action: 'idle', actionUntil: 0, previous: new THREE.Vector3() };
  return root;
}

type RigState = 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'summon';

export function setRigState(actor: THREE.Group, action: RigState, time: number, duration = .32): void {
  const rig = actor.userData.rig as { action: RigState; actionUntil: number } | undefined;
  if (!rig) return;
  rig.action = action;
  rig.actionUntil = time + duration;
}

export function animateRig(actor: THREE.Group, time: number, movementSpeed = 0): void {
  const rig = actor.userData.rig as { pose: THREE.Group; sprite: THREE.Sprite; aura: THREE.Mesh; halo: THREE.Sprite; phase: number; player: boolean; boss: boolean; action: RigState; actionUntil: number; previous: THREE.Vector3 } | undefined;
  if (!rig) return;
  if (time > rig.actionUntil && rig.action !== 'move') rig.action = movementSpeed > .2 ? 'move' : 'idle';
  if (rig.action === 'idle' && movementSpeed > .2) rig.action = 'move';
  if (rig.action === 'move' && movementSpeed <= .2) rig.action = 'idle';
  const cadence = rig.action === 'move' ? 8.5 : rig.boss ? 2.2 : 3.4;
  const pulse = Math.sin(time * cadence + rig.phase);
  const attack = rig.action === 'attack' ? Math.sin(Math.min(1, Math.max(0, (rig.actionUntil - time) / .32)) * Math.PI) : 0;
  const cast = rig.action === 'cast' || rig.action === 'summon' ? Math.sin(Math.min(1, Math.max(0, (rig.actionUntil - time) / .65)) * Math.PI) : 0;
  const hit = rig.action === 'hit' ? Math.sin(Math.min(1, Math.max(0, (rig.actionUntil - time) / .24)) * Math.PI) : 0;
  rig.pose.position.y = Math.max(0, pulse * (rig.action === 'move' ? .13 : .065) + .08 + cast * .24);
  rig.pose.rotation.z = pulse * (rig.action === 'move' ? .045 : .018) - attack * .17 + hit * .12;
  rig.pose.scale.set(1 + attack * .12 - hit * .08, 1 - attack * .08 + cast * .09, 1);
  (rig.sprite.material as THREE.SpriteMaterial).color.set(hit > .04 ? '#ff6b62' : cast > .04 ? '#fff4c2' : '#ffffff');
  rig.halo.material.rotation += .005 + movementSpeed * .0008;
  rig.halo.material.opacity = .16 + (pulse + 1) * .075;
  rig.halo.scale.setScalar(1 + cast * .34);
  (rig.aura.material as THREE.MeshBasicMaterial).opacity = .24 + (pulse + 1) * .12 + cast * .28;
  rig.aura.scale.setScalar(1 + (pulse + 1) * .08 + cast * .38);
  rig.previous.copy(actor.position);
}

export function buildMaterialWorld(ctx: { scene: THREE.Scene; decor: THREE.Group; civ: Civilization }): void {
  ctx.decor.clear();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.fillStyle = ctx.civ.palette.ground; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 800; i += 1) {
    const x = Math.random() * 1024; const y = Math.random() * 1024; const r = 2 + Math.random() * 12;
    g.fillStyle = i % 3 ? 'rgba(245,220,150,.035)' : 'rgba(0,0,0,.075)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 32; i += 1) {
    g.strokeStyle = `rgba(255,230,160,${.025 + Math.random() * .03})`; g.lineWidth = 2;
    g.beginPath(); g.arc(512, 512, 70 + i * 18, 0, Math.PI * 2); g.stroke();
  }
  const terrain = new THREE.CanvasTexture(canvas); terrain.colorSpace = THREE.SRGBColorSpace; terrain.wrapS = terrain.wrapT = THREE.RepeatWrapping; terrain.repeat.set(2.8, 2.8);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(17.2, 96), new THREE.MeshPhysicalMaterial({ map: terrain, roughness: .88, metalness: .2, clearcoat: .12, clearcoatRoughness: .6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; ctx.decor.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16.9, .13, 10, 96), new THREE.MeshStandardMaterial({ color: ctx.civ.palette.primary, emissive: ctx.civ.palette.primary, emissiveIntensity: .7, metalness: .86, roughness: .22 })); rim.rotation.x = Math.PI / 2; rim.position.y = .04; ctx.decor.add(rim);
  const shrine = propSprite(2, ctx.civ.palette.glow, 5.1); shrine.position.set(0, 1.4, 0); shrine.userData.baseY = 1.4; ctx.decor.add(shrine);
  const rng = mulberry(ctx.civ.seed);
  for (let i = 0; i < 32; i += 1) {
    const angle = rng() * Math.PI * 2; const radius = 4.6 + rng() * 10.7;
    const prop = propSprite((i + ctx.civ.index * 3) % 20, '#ffffff', 1.6 + rng() * 2.1);
    prop.position.set(Math.cos(angle) * radius, .7 + rng() * .55, Math.sin(angle) * radius); prop.userData.baseY = prop.position.y; prop.userData.phase = rng() * Math.PI * 2;
    prop.material.opacity = .76 + rng() * .22; ctx.decor.add(prop);
  }
  const emberGeo = new THREE.BufferGeometry(); const particles: number[] = [];
  for (let i = 0; i < 260; i += 1) particles.push((rng() - .5) * 32, .1 + rng() * 5.8, (rng() - .5) * 32);
  emberGeo.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: ctx.civ.palette.glow, size: .07, transparent: true, opacity: .68, depthWrite: false })); ctx.decor.add(embers);
  const realmLight = new THREE.PointLight(ctx.civ.palette.glow, 4.7, 15, 2); realmLight.position.set(0, 4.5, 0); ctx.scene.add(realmLight);
  ctx.decor.userData.livingWorld = { shrine, embers, realmLight, props: ctx.decor.children.filter((item) => item.type === 'Sprite' && item !== shrine), phase: rng() * Math.PI * 2 };
}

export function animateLivingWorld(decor: THREE.Group, time: number, combatIntensity: number): void {
  const world = decor.userData.livingWorld as { shrine: THREE.Sprite; embers: THREE.Points; realmLight: THREE.PointLight; props: THREE.Sprite[]; phase: number } | undefined;
  if (!world) return;
  const breath = Math.sin(time * 1.45 + world.phase);
  world.shrine.position.y = Number(world.shrine.userData.baseY ?? 1.4) + breath * .11;
  world.shrine.material.rotation += .0015;
  world.shrine.material.opacity = .82 + (breath + 1) * .08;
  world.embers.rotation.y += .0008 + combatIntensity * .00035;
  world.embers.position.y = (time * .08) % 1.4;
  world.realmLight.intensity = 3.8 + (breath + 1) * .8 + combatIntensity * .45;
  world.props.forEach((prop, index) => {
    const phase = Number(prop.userData.phase ?? index);
    prop.position.y = Number(prop.userData.baseY ?? .8) + Math.sin(time * (.45 + index % 4 * .08) + phase) * .035;
    prop.material.rotation = Math.sin(time * .25 + phase) * .006;
  });
}

function propSprite(index: number, color: string, size: number): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: atlasTexture(propAtlas, index), transparent: true, depthWrite: false, color }));
  sprite.center.set(.5, 0); sprite.scale.set(size, size, 1); return sprite;
}

function mulberry(seed: number): () => number { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
