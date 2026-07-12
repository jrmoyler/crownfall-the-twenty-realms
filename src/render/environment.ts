import * as THREE from 'three';
import type { Civilization } from '../simulation/types';

type Banner = { cloth: THREE.Mesh; base: Float32Array; phase: number };

interface EnvState {
  core: THREE.Mesh;
  rings: { mesh: THREE.Mesh; spin: number }[];
  embers: THREE.Points;
  light: THREE.PointLight;
  sun: THREE.DirectionalLight;
  banners: Banner[];
  crystalMaterial: THREE.MeshStandardMaterial;
  phase: number;
}

function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(rng: () => number): (x: number, z: number) => number {
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rng();
  const at = (x: number, z: number) => grid[(((z % size) + size) % size) * size + (((x % size) + size) % size)];
  return (x, z) => {
    const ix = Math.floor(x); const iz = Math.floor(z);
    const fx = x - ix; const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx); const sz = fz * fz * (3 - 2 * fz);
    const a = at(ix, iz); const b = at(ix + 1, iz); const c = at(ix, iz + 1); const d = at(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
}

function fbm(noise: (x: number, z: number) => number, x: number, z: number, octaves = 4): number {
  let total = 0; let amplitude = .5; let frequency = 1; let max = 0;
  for (let i = 0; i < octaves; i += 1) {
    total += noise(x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= .5;
    frequency *= 2.1;
  }
  return total / max;
}

const smooth = (x: number, lo: number, hi: number) => THREE.MathUtils.smoothstep(x, lo, hi);

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uMoon;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + .1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.58));
  col += uGlow * 0.14 * pow(1.0 - h, 6.0);
  float star = step(0.9974, hash(floor(d * 290.0))) * smoothstep(0.05, 0.3, d.y);
  col += vec3(star * 0.85);
  float m = dot(d, normalize(uMoon));
  float ring = smoothstep(0.9982, 0.9992, m) - smoothstep(0.9992, 0.9997, m);
  float disc = smoothstep(0.9992, 0.9996, m);
  col = mix(col, uGlow * 1.6, ring * 0.9);
  col = mix(col, vec3(0.012, 0.012, 0.028), disc);
  gl_FragColor = vec4(col, 1.0);
}`;

function arenaTexture(civ: Civilization, rng: () => number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  const base = new THREE.Color(civ.palette.ground).lerp(new THREE.Color('#ffffff'), .1);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 1600; i += 1) {
    const x = rng() * 1024; const y = rng() * 1024; const r = 1.5 + rng() * 7;
    g.fillStyle = rng() > .3 ? 'rgba(245,220,150,.03)' : 'rgba(0,0,0,.055)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 26; i += 1) {
    g.strokeStyle = `rgba(255,230,160,${.03 + rng() * .035})`;
    g.lineWidth = 2 + (i % 3);
    g.beginPath(); g.arc(512, 512, 60 + i * 18, 0, Math.PI * 2); g.stroke();
  }
  // spoke lines toward the shrine
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    g.strokeStyle = 'rgba(255,230,160,.05)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(512 + Math.cos(a) * 90, 512 + Math.sin(a) * 90);
    g.lineTo(512 + Math.cos(a) * 480, 512 + Math.sin(a) * 480); g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function buildTerrain(civ: Civilization, noise: (x: number, z: number) => number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(150, 150, 108, 108);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const heightAt = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const rolling = (fbm(noise, x * .045, z * .045) - .5) * 5.4 + (fbm(noise, x * .17, z * .17) - .5) * 1.1;
    const openness = smooth(r, 15.5, 30);
    const rim = smooth(r, 34, 64);
    return rolling * openness + rim * (5 + fbm(noise, x * .028 + 9, z * .028 + 9) * 10);
  };
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, heightAt(positions.getX(i), positions.getZ(i)));
  }
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal as THREE.BufferAttribute;
  const ground = new THREE.Color(civ.palette.ground).lerp(new THREE.Color('#ffffff'), .14);
  const rock = new THREE.Color(civ.palette.ground).lerp(new THREE.Color('#101018'), .55);
  const peak = new THREE.Color(civ.palette.ground).lerp(new THREE.Color(civ.palette.glow), .18);
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i);
    const slope = 1 - normals.getY(i);
    color.copy(ground)
      .lerp(rock, Math.min(1, slope * 2.4 + Math.max(0, y) * .06))
      .lerp(peak, smooth(y, 5, 12) * .65);
    const dither = (fbm(noise, positions.getX(i) * .8, positions.getZ(i) * .8) - .5) * .12;
    color.offsetHSL(0, 0, dither);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: .05 }));
  terrain.position.y = -.05;
  terrain.receiveShadow = true;
  return terrain;
}

function scatter(rng: () => number, minRadius: number, maxRadius: number): { x: number; z: number } {
  const angle = rng() * Math.PI * 2;
  const radius = minRadius + Math.sqrt(rng()) * (maxRadius - minRadius);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

export function buildEnvironment(ctx: { scene: THREE.Scene; decor: THREE.Group; civ: Civilization }): void {
  const { scene, decor, civ } = ctx;
  decor.clear();
  const rng = mulberry(civ.seed);
  const noise = valueNoise(mulberry(civ.seed ^ 0x9e3779b9));
  const glowColor = new THREE.Color(civ.palette.glow);
  const groundColor = new THREE.Color(civ.palette.ground);
  const horizon = groundColor.clone().lerp(glowColor, .28).multiplyScalar(.5);
  const zenith = groundColor.clone().lerp(new THREE.Color('#05060f'), .82);

  scene.background = zenith.clone();
  scene.fog = new THREE.FogExp2(horizon.getHex(), .0115);

  // sky dome: gradient, procedural stars and an eclipse ring
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(72, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: zenith },
        uHorizon: { value: horizon },
        uGlow: { value: glowColor },
        uMoon: { value: new THREE.Vector3(-.45, .38, -.8) },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    }),
  );
  sky.renderOrder = -1;
  decor.add(sky);

  decor.add(buildTerrain(civ, noise));

  const arena = new THREE.Mesh(
    new THREE.CircleGeometry(16.8, 96),
    new THREE.MeshStandardMaterial({ map: arenaTexture(civ, rng), roughness: .84, metalness: .1 }),
  );
  arena.rotation.x = -Math.PI / 2;
  arena.position.y = .02;
  arena.receiveShadow = true;
  decor.add(arena);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(16.7, .14, 10, 96),
    new THREE.MeshStandardMaterial({ color: civ.palette.primary, emissive: civ.palette.primary, emissiveIntensity: .7, metalness: .85, roughness: .25 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .06;
  decor.add(rim);

  // central shrine
  const stone = new THREE.MeshStandardMaterial({ color: '#4a4d63', roughness: .6, metalness: .3 });
  const glowMat = new THREE.MeshStandardMaterial({ color: civ.palette.primary, emissive: civ.palette.glow, emissiveIntensity: 1.8, metalness: .7, roughness: .25 });
  const shrine = new THREE.Group();
  const daisLow = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.1, .3, 12), stone);
  daisLow.position.y = .15; daisLow.castShadow = daisLow.receiveShadow = true; shrine.add(daisLow);
  const daisHigh = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, .4, 12), stone);
  daisHigh.position.y = .48; daisHigh.castShadow = daisHigh.receiveShadow = true; shrine.add(daisHigh);
  for (let i = 0; i < 4; i += 1) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.14, .22, 1.6, 6), stone);
    pillar.position.set(Math.cos(i * Math.PI / 2 + Math.PI / 4) * 1.6, 1.2, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 1.6);
    pillar.castShadow = true;
    shrine.add(pillar);
  }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(.58), glowMat);
  core.position.y = 1.95; core.castShadow = true; shrine.add(core);
  const rings = [
    { mesh: new THREE.Mesh(new THREE.TorusGeometry(1.1, .05, 8, 40), glowMat), spin: .7 },
    { mesh: new THREE.Mesh(new THREE.TorusGeometry(.82, .04, 8, 36), glowMat), spin: -1.15 },
  ];
  rings.forEach(({ mesh }, index) => { mesh.position.y = 1.95; mesh.rotation.x = 1.1 + index * .5; shrine.add(mesh); });
  decor.add(shrine);

  // relic wells
  [new THREE.Vector3(-7, 0, -4), new THREE.Vector3(8, 0, 4)].forEach((position, index) => {
    const well = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.7, .95, .28, 8), stone);
    base.position.y = .14; base.castShadow = true; well.add(base);
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(.28, .85, 5), glowMat);
    crystal.position.y = .68; crystal.rotation.y = index; crystal.castShadow = true; well.add(crystal);
    well.position.copy(position);
    decor.add(well);
  });

  // ruined pillar ring outside the arena
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + rng() * .4;
    const radius = 18.5 + rng() * 4.5;
    const height = 2.2 + rng() * 1.6;
    const broken = rng() > .55;
    const column = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, broken ? height * .55 : height, 8), stone);
    shaft.position.y = (broken ? height * .55 : height) / 2;
    shaft.castShadow = true;
    column.add(shaft);
    if (!broken) {
      const capital = new THREE.Mesh(new THREE.BoxGeometry(1.05, .3, 1.05), stone);
      capital.position.y = height + .15; capital.castShadow = true; column.add(capital);
    }
    column.rotation.z = (rng() - .5) * (broken ? .16 : .04);
    column.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    decor.add(column);
  }

  // instanced rocks, crystals and ground tufts across the terrain
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();

  const rockMaterial = new THREE.MeshStandardMaterial({ color: '#3a3b47', roughness: .95, metalness: .05 });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMaterial, 30);
  rocks.castShadow = true;
  for (let i = 0; i < 30; i += 1) {
    const spot = scatter(rng, 17.5, 55);
    const s = .5 + rng() * 2.1;
    position.set(spot.x, s * .3, spot.z);
    euler.set(rng() * .6, rng() * Math.PI * 2, rng() * .6);
    scale.set(s, s * (.6 + rng() * .4), s);
    matrix.compose(position, quaternion.setFromEuler(euler), scale);
    rocks.setMatrixAt(i, matrix);
    rocks.setColorAt(i, new THREE.Color('#ffffff').offsetHSL(0, 0, (rng() - .5) * .25));
  }
  decor.add(rocks);

  const crystalMaterial = new THREE.MeshStandardMaterial({ color: civ.palette.glow, emissive: civ.palette.glow, emissiveIntensity: 1.2, roughness: .3, metalness: .4 });
  const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.5, 0), crystalMaterial, 22);
  for (let i = 0; i < 22; i += 1) {
    const spot = scatter(rng, 16.5, 44);
    const s = .35 + rng() * .8;
    position.set(spot.x, s * 1.15, spot.z);
    euler.set((rng() - .5) * .5, rng() * Math.PI * 2, (rng() - .5) * .5);
    scale.set(s, s * (1.8 + rng() * 1.2), s);
    matrix.compose(position, quaternion.setFromEuler(euler), scale);
    crystals.setMatrixAt(i, matrix);
  }
  decor.add(crystals);

  if (/forest|canopy|garden|wetland|grove|terrace/i.test(civ.biome)) {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#2c2119', roughness: .9 });
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: groundColor.clone().lerp(glowColor, .45).getHex(), roughness: .85 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .22, 1.7, 6), trunkMaterial, 18);
    const canopies = new THREE.InstancedMesh(new THREE.ConeGeometry(1.05, 2.3, 7), canopyMaterial, 18);
    trunks.castShadow = canopies.castShadow = true;
    for (let i = 0; i < 18; i += 1) {
      const spot = scatter(rng, 19, 50);
      const s = .8 + rng() * .9;
      position.set(spot.x, .85 * s, spot.z);
      scale.setScalar(s);
      matrix.compose(position, quaternion.setFromEuler(euler.set(0, rng() * Math.PI, 0)), scale);
      trunks.setMatrixAt(i, matrix);
      position.y = (1.7 + 1) * s;
      matrix.compose(position, quaternion, scale);
      canopies.setMatrixAt(i, matrix);
    }
    decor.add(trunks);
    decor.add(canopies);
  }

  const tuftMaterial = new THREE.MeshStandardMaterial({ color: groundColor.clone().lerp(glowColor, .3).getHex(), roughness: .9 });
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(.06, .34, 4), tuftMaterial, 130);
  for (let i = 0; i < 130; i += 1) {
    const spot = scatter(rng, 15.5, 48);
    const s = .6 + rng() * 1.4;
    position.set(spot.x, .17 * s, spot.z);
    scale.setScalar(s);
    matrix.compose(position, quaternion.setFromEuler(euler.set((rng() - .5) * .3, 0, (rng() - .5) * .3)), scale);
    tufts.setMatrixAt(i, matrix);
  }
  decor.add(tufts);

  // banner poles with cloth that waves in animateEnvironment
  const banners: Banner[] = [];
  const clothMaterial = new THREE.MeshStandardMaterial({ color: civ.palette.primary, emissive: civ.palette.primary, emissiveIntensity: .3, roughness: .8, side: THREE.DoubleSide });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#191a22', roughness: .55, metalness: .5 });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, 2.9, 6), poleMaterial);
    pole.position.y = 1.45; pole.castShadow = true; group.add(pole);
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(.09), glowMat);
    finial.position.y = 2.95; group.add(finial);
    const clothGeometry = new THREE.PlaneGeometry(1.05, .62, 8, 4);
    clothGeometry.translate(.56, 0, 0); // pin the left edge to the pole
    const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
    cloth.position.y = 2.5;
    group.add(cloth);
    group.position.set(Math.cos(angle) * 13.6, 0, Math.sin(angle) * 13.6);
    group.rotation.y = -angle + Math.PI / 2;
    decor.add(group);
    banners.push({ cloth, base: Float32Array.from((clothGeometry.attributes.position as THREE.BufferAttribute).array), phase: rng() * Math.PI * 2 });
  }

  // drifting embers
  const emberGeometry = new THREE.BufferGeometry();
  const emberPositions: number[] = [];
  for (let i = 0; i < 240; i += 1) emberPositions.push((rng() - .5) * 34, .1 + rng() * 6, (rng() - .5) * 34);
  emberGeometry.setAttribute('position', new THREE.Float32BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({ color: civ.palette.glow, size: .07, transparent: true, opacity: .65, depthWrite: false }));
  decor.add(embers);

  // lighting
  decor.add(new THREE.HemisphereLight('#cfdaff', civ.palette.ground, 2.05));
  const sun = new THREE.DirectionalLight('#ffe2b0', 3.3);
  sun.position.set(-14, 21, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -.0002; sun.shadow.normalBias = .04;
  decor.add(sun);
  const light = new THREE.PointLight(civ.palette.glow, 4.6, 17, 2);
  light.position.set(0, 4.5, 0);
  decor.add(light);

  const state: EnvState = { core, rings, embers, light, sun, banners, crystalMaterial, phase: rng() * Math.PI * 2 };
  decor.userData.env = state;
}

export function animateEnvironment(decor: THREE.Group, time: number, combatIntensity: number): void {
  const env = decor.userData.env as EnvState | undefined;
  if (!env) return;
  const breath = Math.sin(time * 1.35 + env.phase);
  env.core.position.y = 1.95 + breath * .14;
  env.core.rotation.y = time * .8;
  env.rings.forEach(({ mesh, spin }) => { mesh.rotation.y = time * spin; });
  env.light.intensity = 4 + (breath + 1) * .7 + combatIntensity * 1.4;
  env.sun.intensity = 3.1 + Math.sin(time * .14 + env.phase) * .25;
  env.embers.rotation.y = time * .045;
  env.embers.position.y = (time * .3) % 2.4;
  env.crystalMaterial.emissiveIntensity = 1.1 + Math.sin(time * 2.2 + env.phase) * .3 + combatIntensity * .5;
  env.banners.forEach(({ cloth, base, phase }) => {
    const positions = cloth.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i += 1) {
      const x = base[i * 3];
      const reach = Math.max(0, x / 1.09); // 0 at the pole, 1 at the free edge
      positions.setZ(i, Math.sin(time * 3.1 + reach * 4.2 + phase) * .17 * reach);
      positions.setY(i, base[i * 3 + 1] + Math.sin(time * 2.2 + reach * 3.1 + phase) * .05 * reach);
    }
    positions.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
  });
}
