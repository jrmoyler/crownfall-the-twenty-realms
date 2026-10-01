import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  battleFamily, bodyTemplate, groundMaps, propTemplate, REALM_LOOKS, rulerKey, skyTexture, weaponTemplate,
  type BodyKey, type RealmLook,
} from "./assets";
import { action as actionPose, blankPose, copyPose, easePose, HumanRig, mixPose, stance, type Pose, type Style } from "./rig";
import type { Civilization, EnemyRole, Mode, WeaponKind } from "./types";

// Figures ------------------------------------------------------------------------------

export interface FigParts {
  root: THREE.Object3D;
  pivot: THREE.Object3D;
  frame: THREE.Object3D;
  rig: HumanRig;
  weapon: THREE.Object3D | null;
  style: Style;
  materials: THREE.MeshStandardMaterial[];
  pose: Pose;
  target: Pose;
  over: Pose;
  stride: number;
  lastX: number;
  lastZ: number;
  speed: number;
  flash: number;
  glow: string;
}

function styleFor(weapon: WeaponKind | null): Style {
  if (!weapon) return "claw";
  if (weapon === "staff" || weapon === "orb") return "bolt";
  if (weapon === "spear" || weapon === "glaive") return "thrust";
  if (weapon === "hammer") return "maul";
  return "slash";
}

export function buildFigurine(
  civ: Civilization,
  role: "ruler" | EnemyRole | "boss" | "ally",
  boss = false,
): FigParts {
  let key: BodyKey;
  let weaponKind: WeaponKind | null;
  if (role === "ruler" || role === "boss" || boss) {
    key = rulerKey(civ.family);
    weaponKind = civ.weapon;
  } else if (role === "ally") {
    key = "ally";
    weaponKind = "hammer";
  } else if (role === "brute") {
    key = "brute";
    weaponKind = null;
  } else if (role === "mystic") {
    key = "mystic";
    weaponKind = "staff";
  } else if (role === "skirmisher") {
    key = "skirmisher";
    weaponKind = "blade";
  } else {
    key = "soldier";
    weaponKind = civ.weapon === "staff" || civ.weapon === "orb" ? "blade" : civ.weapon;
  }
  const template = bodyTemplate(key) ?? bodyTemplate("brute") ?? bodyTemplate("soldier");
  if (!template) throw new Error(`The ${key} model has not loaded.`);
  const frame = cloneSkinned(template) as THREE.Object3D;
  const materials: THREE.MeshStandardMaterial[] = [];
  const copies = new Map<THREE.Material, THREE.Material>();
  frame.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const remap = (mat: THREE.Material) => {
      let copy = copies.get(mat);
      if (!copy) {
        copy = mat.clone();
        copy.userData["perActor"] = true;
        copies.set(mat, copy);
        if ((copy as THREE.MeshStandardMaterial).isMeshStandardMaterial) materials.push(copy as THREE.MeshStandardMaterial);
      }
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(remap) : remap(mesh.material);
  });
  const pivot = new THREE.Group();
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.add(frame);
  pivot.add(holder);
  root.add(pivot);
  const scale = boss ? 1.3 : role === "ruler" ? 1 : role === "ally" ? 0.96 : 1;
  pivot.scale.setScalar(scale);
  const rig = new HumanRig(holder, pivot);
  let weapon: THREE.Object3D | null = null;
  if (weaponKind) {
    const src = weaponTemplate(weaponKind);
    if (src) {
      weapon = src.clone(true);
      holder.add(weapon);
    }
  }
  const pose = blankPose();
  return {
    root, pivot, frame: holder, rig, weapon, style: styleFor(weaponKind), materials, pose,
    target: blankPose(), over: blankPose(), stride: Math.random() * 6, lastX: 0, lastZ: 0, speed: 0, flash: 0,
    glow: civ.palette.glow,
  };
}

const _hand = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _flashColor = new THREE.Color();

export function poseFigurine(parts: FigParts, time: number, _moving: boolean, act: string, actionAge: number, dt = 1 / 60): void {
  // Speed from actual travel, so strafing, knock-back and standing attacks all read right.
  const dx = parts.root.position.x - parts.lastX;
  const dz = parts.root.position.z - parts.lastZ;
  parts.lastX = parts.root.position.x;
  parts.lastZ = parts.root.position.z;
  const step = Math.hypot(dx, dz);
  const measured = dt > 0 && step < 2 ? step / dt : 0;
  parts.speed += (measured - parts.speed) * Math.min(1, dt * 10);
  const run = Math.min(1, parts.speed / 5.5);
  parts.stride += dt * (4 + parts.speed * 1.55);
  stance(parts.target, parts.style, time, run, parts.stride);
  copyPose(parts.over, parts.target);
  const weight = actionPose(parts.over, parts.style, act, actionAge);
  mixPose(parts.target, parts.over, weight);
  easePose(parts.pose, parts.target, Math.min(1, dt * (weight > 0 ? 22 : 12)));
  if (parts.rig.ok) parts.rig.apply(parts.pose);
  if (parts.weapon) {
    if (!parts.rig.hand("r", _hand)) _hand.set(-0.35, 1.0, 0.25);
    parts.weapon.position.copy(_hand);
    _y.copy(parts.pose.weapon);
    _z.set(0, 0, 1);
    if (Math.abs(_y.dot(_z)) > 0.95) _z.set(0, 1, 0);
    _x.crossVectors(_y, _z).normalize();
    _z.crossVectors(_x, _y).normalize();
    _basis.makeBasis(_x, _y, _z);
    parts.weapon.quaternion.setFromRotationMatrix(_basis);
  }
  const hitFlash = act === "hit" && actionAge < 0.12 ? 1 : 0;
  parts.flash += (hitFlash - parts.flash) * Math.min(1, dt * 30);
  if (parts.flash > 0.01 || hitFlash) {
    _flashColor.set("#ff5a3c").multiplyScalar(parts.flash * 0.8);
    parts.materials.forEach((mat) => mat.emissive.copy(_flashColor));
  }
}

// Renderer -----------------------------------------------------------------------------
// One WebGL context for the life of the page. Phones (iOS Safari above all) kill the tab
// after a handful of contexts, which is exactly what a new renderer per battle did.

let shared: THREE.WebGLRenderer | null = null;
let lost = false;
const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function sharedRenderer(): THREE.WebGLRenderer {
  if (shared && !lost) return shared;
  const canvas = document.createElement("canvas");
  canvas.id = "cf-canvas";
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !coarse || (window.devicePixelRatio || 1) < 2,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = coarse ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
  });
  shared = renderer;
  lost = false;
  return renderer;
}

export function contextLost(): boolean {
  return lost;
}

// Ground -------------------------------------------------------------------------------

function groundMaterial(look: RealmLook, tint: THREE.Color): THREE.MeshStandardMaterial {
  const base = groundMaps(look.ground);
  const blend = groundMaps(look.blend);
  const mat = new THREE.MeshStandardMaterial({
    map: base?.diff ?? null,
    normalMap: base?.nor ?? null,
    roughnessMap: base?.arm ?? null,
    aoMap: base?.arm ?? null,
    roughness: 1,
    metalness: 0,
    color: tint,
  });
  mat.normalScale.set(1.2, 1.2);
  const tile = 0.22;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms["blendMap"] = { value: blend?.diff ?? base?.diff ?? null };
    shader.uniforms["blendArm"] = { value: blend?.arm ?? base?.arm ?? null };
    shader.uniforms["tile"] = { value: tile };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vWorld;
uniform sampler2D blendMap;
uniform sampler2D blendArm;
uniform float tile;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return noise2(p) * 0.55 + noise2(p * 2.1 + 7.3) * 0.3 + noise2(p * 4.3 - 2.1) * 0.15; }
float blendMask() { return smoothstep(0.42, 0.68, fbm(vWorld.xz * 0.11)); }`)
      .replace("#include <map_fragment>", `
vec2 guv = vWorld.xz * tile;
vec4 baseTex = texture2D(map, guv);
vec4 baseTex2 = texture2D(map, guv * 0.37 + 0.13);
baseTex.rgb = mix(baseTex.rgb, baseTex2.rgb, 0.35);
vec4 blendTex = texture2D(blendMap, guv * 0.8);
float bm = blendMask();
vec3 groundRgb = mix(baseTex.rgb, blendTex.rgb, bm);
groundRgb *= 0.82 + 0.36 * fbm(vWorld.xz * 0.045 + 3.0);
diffuseColor.rgb *= groundRgb;`)
      .replace("#include <roughnessmap_fragment>", `
float roughnessFactor = roughness;
vec4 armA = texture2D(roughnessMap, guv);
vec4 armB = texture2D(blendArm, guv * 0.8);
roughnessFactor *= mix(armA.g, armB.g, bm);`)
      .replace("#include <aomap_fragment>", `
float groundAo = mix(armA.r, armB.r, bm);
reflectedLight.indirectDiffuse *= groundAo;
reflectedLight.indirectSpecular *= groundAo;`)
      .replace("#include <normal_fragment_maps>", `
vec3 mapN = texture2D(normalMap, guv).xyz * 2.0 - 1.0;
mapN.xy *= normalScale;
normal = normalize(tbn * mapN);`);
  };
  return mat;
}

function groundGeometry(): THREE.BufferGeometry {
  const size = 120;
  const seg = coarse ? 120 : 180;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    // Flat fighting floor, rolling ground beyond it, hills that close the horizon.
    const swell = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.25 + Math.sin(x * 0.07 + z * 0.05) * 0.5;
    const edge = THREE.MathUtils.smoothstep(r, 15, 34);
    const hills = THREE.MathUtils.smoothstep(r, 26, 58) * (5 + Math.sin(Math.atan2(z, x) * 5) * 2.5);
    pos.setY(i, swell * edge + hills);
  }
  geo.computeVertexNormals();
  geo.computeTangents?.();
  return geo;
}

export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const swell = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.25 + Math.sin(x * 0.07 + z * 0.05) * 0.5;
  const edge = THREE.MathUtils.smoothstep(r, 15, 34);
  const hills = THREE.MathUtils.smoothstep(r, 26, 58) * (5 + Math.sin(Math.atan2(z, x) * 5) * 2.5);
  return swell * edge + hills;
}

// Stage --------------------------------------------------------------------------------

const burstRing = new THREE.RingGeometry(0.82, 1, 64);
const shotGeo = new THREE.SphereGeometry(1, 12, 8);
const beamGeo = new THREE.CylinderGeometry(0.75, 1.05, 5, 32, 1, true).translate(0, 2.5, 0);

// A soft column of light: bright at the base, gone by the top, brighter at grazing angles.
function beamMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: color }, power: { value: 0.35 }, time: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vNormalV; varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color; uniform float power; uniform float time;
      varying vec2 vUv; varying vec3 vNormalV; varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(vNormalV, vView));
        float fade = pow(1.0 - vUv.y, 2.2);
        float ripple = 0.75 + 0.25 * sin(vUv.y * 18.0 - time * 3.0 + vUv.x * 12.566);
        float a = fade * (0.25 + rim * 0.9) * ripple * power;
        gl_FragColor = vec4(color * a * 2.4, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

interface Fallen {
  parts: FigParts;
  age: number;
  dir: number;
}

export class RealmStage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 220);
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly player: FigParts;
  shrineGlow: THREE.MeshStandardMaterial | null = null;
  wellMats: THREE.MeshStandardMaterial[] = [];
  private readonly owned: Array<THREE.Material | THREE.BufferGeometry | THREE.Texture> = [];
  private readonly clockOffset = Math.random() * 10;
  private readonly sun: THREE.DirectionalLight;
  private readonly fallen: Fallen[] = [];
  private readonly beams: THREE.ShaderMaterial[] = [];
  private readonly fx: THREE.Mesh[] = [];
  private readonly reduced: boolean;
  private pixelRatio = 1;
  private maxRatio = 1;
  private slowFrames = 0;
  private fastFrames = 0;
  private distance = 1;

  constructor(host: HTMLElement, civ: Civilization, rival: Civilization, mode: Mode, reduced: boolean) {
    this.reduced = reduced;
    this.renderer = sharedRenderer();
    this.canvas = this.renderer.domElement;
    const old = host.querySelector("#cf-canvas");
    if (old && old !== this.canvas) old.replaceWith(this.canvas);
    else if (!old) host.prepend(this.canvas);
    this.canvas.setAttribute("aria-label", `${civ.name} battlefield`);
    const family = battleFamily(civ, rival, mode);
    const look = REALM_LOOKS[family];
    const owner = mode === "campaign" ? rival : civ;
    this.renderer.toneMappingExposure = look.exposure;
    this.renderer.shadowMap.enabled = !reduced || !coarse;

    const sky = skyTexture(look.hdri);
    if (sky) {
      this.scene.environment = sky;
      this.scene.background = sky;
      this.scene.backgroundBlurriness = 0.06;
      this.scene.backgroundIntensity = 0.85;
      this.scene.environmentIntensity = 0.75;
    } else {
      this.scene.background = new THREE.Color(look.fog);
    }
    this.scene.fog = new THREE.Fog(look.fog, 34, 95);

    this.sun = new THREE.DirectionalLight(look.sun, look.sunPower);
    this.sun.position.set(-14, 22, 10);
    this.sun.castShadow = true;
    const map = coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(map, map);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 70;
    const span = 17;
    this.sun.shadow.camera.left = -span;
    this.sun.shadow.camera.right = span;
    this.sun.shadow.camera.top = span;
    this.sun.shadow.camera.bottom = -span;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(look.sun, look.fog, 0.35));

    this.buildGround(look, owner);
    this.dress(look, owner.index * 97 + family.length * 13);
    this.placeObjectives(owner);

    this.player = buildFigurine(civ, "ruler");
    this.player.root.position.set(0, 0, 6);
    this.scene.add(this.player.root);
    this.camera.position.set(0, 10, 16);
    this.camera.lookAt(0, 1, 6);
    this.fit();
  }

  private track<T extends THREE.Material | THREE.BufferGeometry | THREE.Texture>(item: T): T {
    this.owned.push(item);
    return item;
  }

  private buildGround(look: RealmLook, owner: Civilization): void {
    const tint = new THREE.Color("#ffffff").lerp(new THREE.Color(owner.palette.ground), 0.08);
    const ground = new THREE.Mesh(this.track(groundGeometry()), this.track(groundMaterial(look, tint)));
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private place(name: string, x: number, z: number, scale: number, yaw: number, shadow = true): THREE.Object3D | null {
    const src = propTemplate(name);
    if (!src) return null;
    const prop = src.clone(true);
    prop.position.set(x, groundHeight(x, z) - 0.05, z);
    prop.rotation.y = yaw;
    prop.scale.setScalar(scale);
    prop.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = shadow && !this.reduced;
    });
    this.scene.add(prop);
    return prop;
  }

  private dress(look: RealmLook, seed: number): void {
    const rand = mulberry(seed);
    const keepOut = (x: number, z: number) =>
      Math.hypot(x, z) < 3.4 || Math.hypot(x + 7, z - 4.6) < 2.8 || Math.hypot(x - 7.2, z + 3.8) < 2.8 || Math.hypot(x, z - 6) < 2.5;
    // Scatter: small dressing inside the arena keeps to the margins, the rest outside it.
    look.props.forEach(([name, count]) => {
      const small = /fern|shrub|sand_rocks|moon_rock|rock_07|root/.test(name);
      for (let i = 0; i < count; i += 1) {
        let x = 0;
        let z = 0;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const a = rand() * Math.PI * 2;
          const r = small ? 6 + rand() * 22 : 13 + rand() * 16;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
          if (!keepOut(x, z)) break;
        }
        const scale = small ? 0.8 + rand() * 0.7 : 0.85 + rand() * 0.5;
        this.place(name, x, z, scale, rand() * Math.PI * 2, !small);
      }
    });
    // A broken ring of large silhouettes closes the field.
    const n = 16;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.25;
      const r = 19 + rand() * 9;
      const name = look.ring[i % look.ring.length]!;
      this.place(name, Math.cos(a) * r, Math.sin(a) * r, 1.1 + rand() * 0.8, rand() * Math.PI * 2);
    }
  }

  private placeObjectives(owner: Civilization): void {
    const glow = new THREE.Color(owner.palette.glow);
    const statue = this.place("gothic_statue", 0, 0, 1.25, Math.PI, true);
    if (statue) statue.position.y = 0;
    const ringMat = this.track(new THREE.MeshStandardMaterial({
      color: "#1b1712", emissive: glow, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.6,
    }));
    const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.6, 0.06, 8, 96)), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    this.scene.add(ring);
    this.shrineGlow = ringMat;
    [[-7, 4.6], [7.2, -3.8]].forEach(([x, z]) => {
      const pit = this.place("stone_fire_pit", x!, z!, 1.5, x!, true);
      // Battle code raises emissiveIntensity when a well is taken; the beam follows it.
      const mat = this.track(new THREE.MeshStandardMaterial({ emissiveIntensity: 0.35 }));
      const beam = this.track(beamMaterial(new THREE.Color(owner.palette.primary).lerp(glow, 0.5)));
      beam.userData["source"] = mat;
      const column = new THREE.Mesh(beamGeo, beam);
      column.position.set(x!, (pit ? groundHeight(x!, z!) : 0) + 0.1, z!);
      this.scene.add(column);
      this.beams.push(beam);
      this.wellMats.push(mat);
      const wellRing = new THREE.Mesh(ring.geometry, ringMat);
      wellRing.rotation.x = Math.PI / 2;
      wellRing.scale.setScalar(0.85);
      wellRing.position.set(x!, groundHeight(x!, z!) + 0.06, z!);
      this.scene.add(wellRing);
    });
  }

  addActor(parts: FigParts): void {
    parts.lastX = parts.root.position.x;
    parts.lastZ = parts.root.position.z;
    this.scene.add(parts.root);
  }

  removeActor(parts: FigParts, fall = true): void {
    if (fall && !this.reduced) {
      this.fallen.push({ parts, age: 0, dir: Math.random() > 0.5 ? 1 : -1 });
      return;
    }
    this.scene.remove(parts.root);
    parts.materials.forEach((mat) => mat.dispose());
  }

  shot(hostile: boolean, color: string, radius: number): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(shotGeo, mat);
    mesh.scale.set(radius * 0.9, radius * 0.9, radius * (hostile ? 1.6 : 2.6));
    this.scene.add(mesh);
    return mesh;
  }

  dropShot(mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
    (mesh.material as THREE.Material).dispose();
  }

  burst(x: number, z: number, color: string, scale = 1): void {
    const mesh = new THREE.Mesh(
      burstRing,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, groundHeight(x, z) + 0.08, z);
    mesh.scale.setScalar(0.15 * scale);
    mesh.userData["ttl"] = 0.45;
    mesh.userData["life"] = 0.45;
    mesh.userData["size"] = scale;
    this.scene.add(mesh);
    this.fx.push(mesh);
  }

  updateFx(dt: number): void {
    for (let i = this.fx.length - 1; i >= 0; i -= 1) {
      const mesh = this.fx[i]!;
      mesh.userData["ttl"] -= dt;
      const life = mesh.userData["life"] as number;
      const k = 1 - mesh.userData["ttl"] / life;
      mesh.scale.setScalar((0.2 + k * 2.4) * Math.max(0.4, mesh.userData["size"] as number));
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
      if (mesh.userData["ttl"] <= 0) {
        this.scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        this.fx.splice(i, 1);
      }
    }
    for (let i = this.fallen.length - 1; i >= 0; i -= 1) {
      const body = this.fallen[i]!;
      body.age += dt;
      const t = Math.min(1, body.age / 0.55);
      const ease = t * t;
      body.parts.pivot.rotation.x = -ease * 1.45;
      body.parts.pivot.rotation.z = ease * 0.25 * body.dir;
      if (body.age > 1.6) body.parts.pivot.position.y = -(body.age - 1.6) * 0.9;
      if (body.age > 2.8) {
        this.scene.remove(body.parts.root);
        body.parts.materials.forEach((mat) => mat.dispose());
        this.fallen.splice(i, 1);
      }
    }
  }

  fit(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || window.innerWidth);
    const height = Math.max(1, rect.height || window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    this.maxRatio = Math.min(dpr, coarse ? 1.5 : 2, this.reduced ? 1.25 : 2);
    if (this.pixelRatio === 1 || this.pixelRatio > this.maxRatio) this.pixelRatio = this.maxRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Portrait phones need to stand further back to see the same width of field.
    this.distance = this.camera.aspect < 1 ? Math.min(1.75, 1 / Math.pow(this.camera.aspect, 0.7)) : 1;
    this.camera.fov = this.camera.aspect < 1 ? 46 : 38;
    this.camera.updateProjectionMatrix();
  }

  // Dynamic resolution: drop pixels before dropping frames.
  private budget(dt: number): void {
    if (dt > 1 / 40) this.slowFrames += 1;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (dt < 1 / 55) this.fastFrames += 1;
    else this.fastFrames = 0;
    if (this.slowFrames > 45 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.15);
      this.slowFrames = 0;
      this.renderer.setPixelRatio(this.pixelRatio);
      this.fit();
    } else if (this.fastFrames > 240 && this.pixelRatio < this.maxRatio) {
      this.pixelRatio = Math.min(this.maxRatio, this.pixelRatio + 0.1);
      this.fastFrames = 0;
      this.renderer.setPixelRatio(this.pixelRatio);
      this.fit();
    }
  }

  render(target: THREE.Vector3, shakeX: number, shakeY: number, time: number, dt: number): void {
    if (contextLost()) return;
    this.budget(dt);
    const look = target.clone();
    look.y = 1.2;
    const d = this.distance;
    const desired = new THREE.Vector3(look.x + shakeX, 10.5 * d + shakeY, look.z + 11.5 * d);
    this.camera.position.lerp(desired, 1 - Math.exp(-5 * Math.max(0.001, dt)));
    this.camera.lookAt(look);
    this.sun.position.set(look.x - 14, 22, look.z + 10);
    this.sun.target.position.copy(look);
    this.sun.target.updateMatrixWorld();
    if (this.shrineGlow) this.shrineGlow.emissiveIntensity = 0.55 + Math.sin(time * 2) * 0.25;
    this.beams.forEach((beam) => {
      const source = beam.userData["source"] as THREE.MeshStandardMaterial;
      beam.uniforms["time"]!.value = time;
      beam.uniforms["power"]!.value = 0.45 + source.emissiveIntensity * 0.6;
    });
    this.renderer.render(this.scene, this.camera);
  }

  project(x: number, y: number, z: number, width: number, height: number): { x: number; y: number; behind: boolean } {
    const v = new THREE.Vector3(x, y, z);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height,
      behind: v.z > 1,
    };
  }

  nowSeed(): number {
    return this.clockOffset;
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      // Prop and body templates own their geometry and textures; only per-battle copies go.
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (mat instanceof THREE.MeshBasicMaterial || mat.userData["perActor"]) mat.dispose();
      });
    });
    this.owned.forEach((item) => item.dispose());
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.setAnimationLoop(null);
  }
}

function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
