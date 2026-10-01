import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Civilization, Family, Mode, WeaponKind } from "./types";

// Everything the battlefield draws comes from public/realm, baked by tools/assets/build.mjs.
// Nothing is fetched until a battle needs it, and a battle only fetches its own realm.

export type BodyKey =
  | "ruler_observatory" | "ruler_basilica" | "ruler_foundry" | "ruler_grove" | "ruler_monolith"
  | "soldier" | "skirmisher" | "brute" | "mystic" | "ally";

export interface RealmLook {
  ground: string;
  blend: string;
  hdri: string;
  sun: string;
  sunPower: number;
  exposure: number;
  fog: string;
  props: ReadonlyArray<readonly [string, number]>; // prop, how many
  ring: ReadonlyArray<string>; // big silhouettes around the arena edge
}

export const REALM_LOOKS: Record<Family, RealmLook> = {
  grove: {
    ground: "forest_floor", blend: "mossy_rock", hdri: "forest_slope", sun: "#ffe6bf", sunPower: 2.6, exposure: 1.0, fog: "#56604a",
    props: [["fern_02", 26], ["shrub_01", 10], ["rock_moss_set_01", 5], ["rock_moss_set_02", 4], ["tree_stump_01", 3], ["root_cluster_01", 4], ["dead_tree_trunk", 2]],
    ring: ["fir_tree_01", "fir_tree_01", "rock_moss_set_02", "fir_tree_01", "dead_tree_trunk"],
  },
  basilica: {
    ground: "cobblestone_floor_04", blend: "sparse_grass", hdri: "kloofendal_48d_partly_cloudy", sun: "#fff1d8", sunPower: 3.0, exposure: 0.95, fog: "#9fa6ad",
    props: [["horse_statue_01", 2], ["stone_fire_pit", 2], ["rock_07", 5], ["shrub_01", 8], ["fern_02", 8]],
    ring: ["horse_statue_01", "rock_face_01", "fir_tree_01", "rock_face_01"],
  },
  foundry: {
    ground: "burned_ground_01", blend: "cracked_red_ground", hdri: "industrial_sunset_02", sun: "#ffb27a", sunPower: 3.1, exposure: 1.05, fog: "#4a2f26",
    props: [["namaqualand_boulder_02", 4], ["namaqualand_boulder_04", 4], ["wooden_barrels_01", 3], ["cannon_01", 2], ["dead_tree_trunk_02", 3], ["stone_fire_pit", 2]],
    ring: ["namaqualand_boulder_05", "dead_tree_trunk_02", "namaqualand_boulder_02", "rock_face_01"],
  },
  observatory: {
    ground: "snow_02", blend: "rock_ground", hdri: "kloofendal_misty_morning", sun: "#e8efff", sunPower: 2.4, exposure: 0.85, fog: "#a9b3c2",
    props: [["moon_rock_01", 6], ["moon_rock_03", 6], ["moon_rock_05", 5], ["coast_rocks_01", 3], ["fir_tree_01", 2]],
    ring: ["rock_face_01", "coast_rocks_01", "fir_tree_01", "rock_face_01"],
  },
  monolith: {
    ground: "aerial_sand", blend: "dry_ground_rocks", hdri: "goegap", sun: "#fff0d0", sunPower: 3.3, exposure: 0.9, fog: "#b59a78",
    props: [["sand_rocks_small_01", 8], ["namaqualand_boulder_04", 4], ["dead_quiver_trunk", 3], ["quiver_tree_01", 2], ["rock_07", 4]],
    ring: ["namaqualand_cliff_01", "quiver_tree_01", "namaqualand_cliff_01", "namaqualand_boulder_05"],
  },
};

// Poly Haven scans arrive at wildly different scales; each is fitted to a size that reads
// right next to a 1.9 m figure. "h" fits the height, "w" the widest footprint.
const PROP_SIZE: Record<string, ["h" | "w", number]> = {
  fern_02: ["w", 1.6], shrub_01: ["w", 1.9], rock_moss_set_01: ["w", 5], rock_moss_set_02: ["w", 5],
  tree_stump_01: ["w", 1.4], root_cluster_01: ["w", 3.4], dead_tree_trunk: ["w", 4.2], fir_tree_01: ["h", 13],
  gothic_statue: ["h", 3.1], horse_statue_01: ["h", 3.6], stone_fire_pit: ["w", 2.3], rock_07: ["w", 1.3],
  namaqualand_boulder_02: ["w", 3], namaqualand_boulder_04: ["w", 3.4], namaqualand_boulder_05: ["w", 2.6],
  dead_tree_trunk_02: ["w", 4.5], cannon_01: ["w", 2.6], wooden_barrels_01: ["w", 3], moon_rock_01: ["w", 2.6],
  moon_rock_03: ["w", 2], moon_rock_05: ["w", 1.6], coast_rocks_01: ["w", 13], rock_face_01: ["h", 6.5],
  namaqualand_cliff_01: ["w", 13], quiver_tree_01: ["h", 4.6], dead_quiver_trunk: ["h", 3.2], sand_rocks_small_01: ["w", 4],
};

const WEAPON_SHAPE: Record<WeaponKind, { length: number; grip: number; wideTop: boolean }> = {
  blade: { length: 1.15, grip: 0.1, wideTop: false },
  staff: { length: 1.7, grip: 0.5, wideTop: true },
  spear: { length: 2.2, grip: 0.42, wideTop: true },
  hammer: { length: 1.15, grip: 0.22, wideTop: true },
  glaive: { length: 1.95, grip: 0.4, wideTop: true },
  orb: { length: 0.95, grip: 0.18, wideTop: true },
};

// Weapons each model carries in its own mesh; we hand them ours instead.
const BUILT_IN_WEAPONS = /axe|sword|scabbard|maul|dagger|staff|kris|spear|rope|stone|skull_low|weapon/i;

const BODY_HEIGHT: Record<BodyKey, number> = {
  ruler_observatory: 1.9, ruler_basilica: 1.95, ruler_foundry: 1.9, ruler_grove: 1.85, ruler_monolith: 1.95,
  soldier: 1.85, skirmisher: 1.45, brute: 2.35, mystic: 1.9, ally: 1.85,
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const textureLoader = new THREE.TextureLoader();
const hdrLoader = new HDRLoader();
const cache = new Map<string, Promise<unknown>>();

function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = make();
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
  }
  return hit;
}

const ready = {
  bodies: new Map<BodyKey, THREE.Object3D>(),
  weapons: new Map<WeaponKind, THREE.Object3D>(),
  props: new Map<string, THREE.Object3D>(),
  grounds: new Map<string, { diff: THREE.Texture; nor: THREE.Texture; arm: THREE.Texture }>(),
  skies: new Map<string, THREE.DataTexture>(),
};

const url = (path: string) => `${import.meta.env.BASE_URL}realm/${path}`;

function prepareBody(key: BodyKey, scene: THREE.Object3D): THREE.Object3D {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (BUILT_IN_WEAPONS.test(mesh.name) || BUILT_IN_WEAPONS.test(mesh.parent?.name ?? "")) mesh.visible = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.envMapIntensity = 1;
        if (std.map) std.map.anisotropy = 4;
      }
    });
  });
  // Face +Z: toes point the way the character looks.
  scene.updateMatrixWorld(true);
  const forward = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  scene.traverse((obj) => {
    if (!(obj as THREE.Bone).isBone || !/toe/i.test(obj.name) || !obj.parent || !(obj.parent as THREE.Bone).isBone) return;
    obj.getWorldPosition(a);
    obj.parent.getWorldPosition(b);
    forward.add(a.sub(b).setY(0));
  });
  const facing = forward.lengthSq() > 1e-8 ? Math.atan2(forward.x, forward.z) : 0;
  const model = new THREE.Group();
  model.add(scene);
  model.rotation.y = Math.abs(facing) > 0.6 ? -facing : 0;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.visible) box.expandByObject(mesh);
  });
  const size = box.getSize(new THREE.Vector3());
  const scale = BODY_HEIGHT[key] / Math.max(0.01, size.y);
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;
  return model;
}

function prepareWeapon(kind: WeaponKind, scene: THREE.Object3D): THREE.Object3D {
  const shape = WEAPON_SHAPE[kind];
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // Long axis becomes +Y, the next becomes +X (the edge plane).
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const order = [0, 1, 2].sort((p, q) => size.getComponent(q) - size.getComponent(p));
  const long = axes[order[0]!]!;
  const wide = axes[order[1]!]!;
  // Which end is the head? Compare how spread the vertices are near each end.
  const spread = [0, 0];
  const v = new THREE.Vector3();
  const L = size.getComponent(order[0]!);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).sub(center);
      const t = v.dot(long) / L + 0.5;
      const off = Math.abs(v.dot(wide));
      if (t < 0.18) spread[0] = Math.max(spread[0]!, off);
      if (t > 0.82) spread[1] = Math.max(spread[1]!, off);
    }
  });
  const topIsPositive = shape.wideTop ? spread[1]! >= spread[0]! : spread[1]! <= spread[0]!;
  const up = long.clone().multiplyScalar(topIsPositive ? 1 : -1);
  const basis = new THREE.Matrix4().makeBasis(wide, up, new THREE.Vector3().crossVectors(wide, up));
  const rotate = new THREE.Quaternion().setFromRotationMatrix(basis).invert();
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(scene);
  scene.position.sub(center);
  inner.quaternion.copy(rotate);
  const scale = shape.length / L;
  inner.scale.setScalar(scale);
  inner.position.y = (0.5 - shape.grip) * shape.length;
  holder.add(inner);
  holder.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return holder;
}

function loadBody(key: BodyKey): Promise<void> {
  return once(`body:${key}`, async () => {
    const gltf = await loader.loadAsync(url(`characters/${key}.glb`));
    ready.bodies.set(key, prepareBody(key, gltf.scene));
  });
}

function loadWeapon(kind: WeaponKind): Promise<void> {
  return once(`weapon:${kind}`, async () => {
    const gltf = await loader.loadAsync(url(`weapons/${kind}.glb`));
    ready.weapons.set(kind, prepareWeapon(kind, gltf.scene));
  });
}

function loadProp(name: string): Promise<void> {
  return once(`prop:${name}`, async () => {
    const gltf = await loader.loadAsync(url(`props/${name}.glb`));
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.anisotropy = 4;
      if (mat.transparent || mat.alphaTest > 0) {
        mat.alphaTest = Math.max(mat.alphaTest, 0.5);
        mat.transparent = false;
        mat.side = THREE.DoubleSide;
      }
    });
    const fit = PROP_SIZE[name];
    const holder = new THREE.Group();
    holder.add(gltf.scene);
    if (fit) {
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const measure = fit[0] === "h" ? size.y : Math.max(size.x, size.z);
      const scale = fit[1] / Math.max(0.001, measure);
      const center = box.getCenter(new THREE.Vector3());
      gltf.scene.scale.multiplyScalar(scale);
      gltf.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    }
    ready.props.set(name, holder);
  });
}

function loadGround(id: string): Promise<void> {
  return once(`ground:${id}`, async () => {
    const [diff, nor, arm] = await Promise.all(["diff", "nor", "arm"].map((kind) => textureLoader.loadAsync(url(`ground/${id}_${kind}.webp`))));
    diff!.colorSpace = THREE.SRGBColorSpace;
    [diff!, nor!, arm!].forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
    });
    ready.grounds.set(id, { diff: diff!, nor: nor!, arm: arm! });
  });
}

function loadSky(id: string): Promise<void> {
  return once(`sky:${id}`, async () => {
    const tex = await hdrLoader.loadAsync(url(`sky/${id}.hdr`));
    tex.mapping = THREE.EquirectangularReflectionMapping;
    ready.skies.set(id, tex);
  });
}

export function rulerKey(family: Family): BodyKey {
  return `ruler_${family}` as BodyKey;
}

export function battleFamily(civ: Civilization, rival: Civilization, mode: Mode): Family {
  return mode === "campaign" ? rival.family : civ.family;
}

// Everything the opening of a battle needs. Later warlords stream in behind it.
export async function loadBattle(civ: Civilization, rival: Civilization, mode: Mode, onProgress?: (k: number) => void): Promise<void> {
  const look = REALM_LOOKS[battleFamily(civ, rival, mode)];
  const jobs: Promise<void>[] = [
    loadBody(rulerKey(civ.family)), loadBody(rulerKey(rival.family)),
    loadBody("soldier"), loadBody("skirmisher"), loadBody("brute"), loadBody("mystic"), loadBody("ally"),
    loadWeapon(civ.weapon), loadWeapon(rival.weapon), loadWeapon("blade"), loadWeapon("staff"), loadWeapon("hammer"),
    loadGround(look.ground), loadGround(look.blend), loadSky(look.hdri),
    ...new Set([...look.props.map(([name]) => name), ...look.ring, "gothic_statue", "stone_fire_pit"].map((name) => loadProp(name))),
  ];
  let done = 0;
  jobs.forEach((job) => job.then(() => onProgress?.(++done / jobs.length), () => undefined));
  await Promise.all(jobs);
  if (mode === "survival") {
    (["observatory", "basilica", "foundry", "grove", "monolith"] as Family[]).forEach((family) => void loadBody(rulerKey(family)).catch(() => undefined));
    (["blade", "staff", "spear", "hammer", "glaive", "orb"] as WeaponKind[]).forEach((kind) => void loadWeapon(kind).catch(() => undefined));
  }
}

export function preloadRival(rival: Civilization): void {
  void loadBody(rulerKey(rival.family)).catch(() => undefined);
  void loadWeapon(rival.weapon).catch(() => undefined);
}

export function bodyTemplate(key: BodyKey): THREE.Object3D | undefined {
  return ready.bodies.get(key);
}

export function weaponTemplate(kind: WeaponKind): THREE.Object3D | undefined {
  return ready.weapons.get(kind) ?? ready.weapons.get("blade");
}

export function propTemplate(name: string): THREE.Object3D | undefined {
  return ready.props.get(name);
}

export function groundMaps(id: string) {
  return ready.grounds.get(id);
}

export function skyTexture(id: string): THREE.DataTexture | undefined {
  return ready.skies.get(id);
}

export function liftColor(hex: string, toward: string, amount: number): THREE.Color {
  return new THREE.Color(hex).lerp(new THREE.Color(toward), amount);
}
