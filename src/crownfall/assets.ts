import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { EnemyRole, Family, WeaponKind } from "./types";

const ROLES = ["ruler", "soldier", "skirmisher", "brute", "mystic"] as const;
const WEAPONS: WeaponKind[] = ["staff", "blade", "hammer", "spear", "glaive", "orb"];
const PROPS = [
  "tree", "tree_b", "boulder", "boulder_b", "arch", "banner", "stack", "spire",
  "monolith", "shrine", "well", "cairn", "roots", "tuft", "terrain",
] as const;

const MAPS: Record<string, { color: string; rough: string; normal: string }> = {
  Cloth: { color: "cloth.png", rough: "cloth_r.png", normal: "cloth_n.png" },
  Leather: { color: "leather.png", rough: "leather_r.png", normal: "leather_n.png" },
  Wood: { color: "leather.png", rough: "leather_r.png", normal: "leather_n.png" },
  Plate: { color: "metal.png", rough: "metal_r.png", normal: "metal_n.png" },
  Metal: { color: "metal.png", rough: "metal_r.png", normal: "metal_n.png" },
  Trim: { color: "metal.png", rough: "metal_r.png", normal: "metal_n.png" },
  Skin: { color: "skin.png", rough: "skin_r.png", normal: "skin_n.png" },
  Stone: { color: "stone.png", rough: "stone_r.png", normal: "stone_n.png" },
  Earth: { color: "earth.png", rough: "earth_r.png", normal: "earth_n.png" },
  Foliage: { color: "cloth.png", rough: "cloth_r.png", normal: "cloth_n.png" },
  Well: { color: "leather.png", rough: "leather_r.png", normal: "leather_n.png" },
};

export interface RealmLibrary {
  bodies: Map<string, THREE.Object3D>;
  weapons: Map<WeaponKind, THREE.Object3D>;
  props: Map<string, THREE.Object3D>;
  sky: THREE.Texture;
  textures: Map<string, THREE.Texture>;
}

let library: RealmLibrary | null = null;
let pending: Promise<RealmLibrary> | null = null;

function url(path: string): string {
  return `/${path.replace(/^\//, "")}`;
}

export function loadRealmLibrary(): Promise<RealmLibrary> {
  if (library) return Promise.resolve(library);
  if (!pending) pending = fetchLibrary();
  return pending;
}

export function realmLibrary(): RealmLibrary {
  if (!library) throw new Error("The realm models have not finished loading.");
  return library;
}

async function fetchLibrary(): Promise<RealmLibrary> {
  const loader = new GLTFLoader();
  const families: Family[] = ["observatory", "basilica", "foundry", "grove", "monolith"];
  const bodies = new Map<string, THREE.Object3D>();
  const weapons = new Map<WeaponKind, THREE.Object3D>();
  const props = new Map<string, THREE.Object3D>();
  const jobs: Promise<void>[] = [];
  const load = (path: string, into: (root: THREE.Object3D) => void) => {
    jobs.push(loader.loadAsync(url(path)).then((gltf) => into(gltf.scene)));
  };
  families.forEach((family) => {
    ROLES.forEach((role) => {
      load(`models/bodies/${family}_${role}.glb`, (root) => bodies.set(`${family}_${role}`, root));
    });
  });
  WEAPONS.forEach((kind) => {
    load(`models/weapons/${kind}.glb`, (root) => weapons.set(kind, root));
  });
  PROPS.forEach((name) => {
    load(`models/props/${name}.glb`, (root) => props.set(name, root));
  });
  const skyLoader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  const textureNames = [
    "cloth.png", "cloth_r.png", "cloth_n.png",
    "metal.png", "metal_r.png", "metal_n.png",
    "skin.png", "skin_r.png", "skin_n.png",
    "leather.png", "leather_r.png", "leather_n.png",
    "stone.png", "stone_r.png", "stone_n.png",
    "earth.png", "earth_r.png", "earth_n.png",
  ];
  await Promise.all(textureNames.map(async (name) => {
    const texture = await skyLoader.loadAsync(url(`models/textures/${name}`));
    const data = name.endsWith("_n.png") || name.endsWith("_r.png");
    texture.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    textures.set(name, texture);
  }));
  const sky = await skyLoader.loadAsync(url("models/sky.png"));
  sky.colorSpace = THREE.SRGBColorSpace;
  await Promise.all(jobs);
  library = { bodies, weapons, props, sky, textures };
  return library;
}

function bindTextures(material: THREE.MeshStandardMaterial, name: string): void {
  const pack = MAPS[name];
  const textures = library?.textures;
  if (!pack || !textures) return;
  material.map = textures.get(pack.color) ?? null;
  material.roughnessMap = textures.get(pack.rough) ?? null;
  material.normalMap = textures.get(pack.normal) ?? null;
}

export function cloneModel(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const remap = (material: THREE.Material) => {
      let copy = materials.get(material);
      if (!copy) {
        copy = material.clone();
        materials.set(material, copy);
      }
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(remap) : remap(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const bound = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    bound.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) bindTextures(material, slotName(material));
    });
  });
  return clone;
}

export function bodyKey(family: Family, role: "ruler" | EnemyRole | "boss" | "ally", boss = false): string {
  if (boss || role === "boss" || role === "ruler") return `${family}_ruler`;
  if (role === "skirmisher") return `${family}_skirmisher`;
  if (role === "brute") return `${family}_brute`;
  if (role === "mystic") return `${family}_mystic`;
  return `${family}_soldier`;
}

export function slotName(material: THREE.Material): string {
  return material.name.split(".")[0] || material.name;
}

export function liftColor(hex: string, toward: string, amount: number): THREE.Color {
  return new THREE.Color(hex).lerp(new THREE.Color(toward), amount);
}
