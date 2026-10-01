import * as THREE from "three";
import { bodyKey, cloneModel, liftColor, realmLibrary, slotName } from "./assets";
import type { Civilization, EnemyRole, Family, WeaponKind } from "./types";

export interface FigParts {
  root: THREE.Object3D;
  cape: THREE.Object3D;
  weapon: THREE.Object3D;
  glow: THREE.MeshStandardMaterial[];
  metals: THREE.MeshStandardMaterial[];
}

const burstRing = new THREE.RingGeometry(0.85, 1, 48);

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((obj) => {
    if (found) return;
    const base = obj.name.replace(/\.\d+$/, "");
    if (base === name) found = obj;
  });
  return found;
}

function eachMaterial(root: THREE.Object3D, visit: (material: THREE.MeshStandardMaterial, name: string) => void): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    list.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) visit(material, slotName(material));
    });
  });
}

function tintFigure(root: THREE.Object3D, civ: Civilization, glow: THREE.MeshStandardMaterial[], metals: THREE.MeshStandardMaterial[]): void {
  eachMaterial(root, (material, name) => {
    if (name === "Cloth") material.color.set(civ.palette.cloth);
    else if (name === "Skin") material.color.set("#f2e4d6");
    else if (name === "Leather") material.color.copy(liftColor(civ.palette.cloth, "#3a2a22", 0.35));
    else if (name === "Plate") {
      material.color.set(civ.palette.primary);
      material.emissive.set(civ.palette.primary);
      material.emissiveIntensity = 0.08;
    } else if (name === "Metal") {
      material.color.set(civ.palette.metal);
      metals.push(material);
    } else if (name === "Trim") {
      material.color.set(civ.palette.glow);
      material.emissive.set(civ.palette.glow);
      material.emissiveIntensity = 0.55;
      glow.push(material);
    } else if (name === "Wood") {
      material.color.copy(liftColor(civ.palette.cloth, "#6a4a32", 0.4));
    }
  });
}

function tintPlace(root: THREE.Object3D, civ: Civilization): void {
  eachMaterial(root, (material, name) => {
    if (name === "Stone") material.color.copy(liftColor(civ.palette.ground, "#c4b6a4", 0.22));
    else if (name === "Earth") material.color.copy(liftColor(civ.palette.ground, "#d9cbb8", 0.28));
    else if (name === "Foliage") material.color.copy(liftColor(civ.palette.primary, "#6f8f45", 0.62));
    else if (name === "Wood") material.color.copy(liftColor(civ.palette.cloth, "#6d5138", 0.45));
    else if (name === "Cloth") material.color.set(civ.palette.cloth);
    else if (name === "Trim") {
      material.color.set(civ.palette.glow);
      material.emissive.set(civ.palette.glow);
      material.emissiveIntensity = 0.7;
    } else if (name === "Well") {
      material.color.set(civ.palette.primary);
      material.emissive.set(civ.palette.primary);
      material.emissiveIntensity = 0.22;
    }
  });
}

export function buildFigurine(
  civ: Civilization,
  role: "ruler" | EnemyRole | "boss" | "ally",
  boss = false,
): FigParts {
  const lib = realmLibrary();
  const key = bodyKey(civ.family, role, boss);
  const template = lib.bodies.get(key) ?? lib.bodies.get(`${civ.family}_soldier`);
  if (!template) throw new Error(`Missing realm body ${key}`);
  const root = cloneModel(template);
  const weaponTemplate = lib.weapons.get(civ.weapon as WeaponKind) ?? lib.weapons.get("blade");
  if (!weaponTemplate) throw new Error("Missing realm weapon");
  const weapon = cloneModel(weaponTemplate);
  const grip = findNamed(root, "Grip") ?? root;
  grip.add(weapon);
  const cape = findNamed(root, "Cape") ?? root;
  const glow: THREE.MeshStandardMaterial[] = [];
  const metals: THREE.MeshStandardMaterial[] = [];
  tintFigure(root, civ, glow, metals);
  const scale = boss ? 1.34 : role === "brute" ? 1.12 : role === "skirmisher" || role === "ally" ? 0.9 : role === "mystic" ? 0.96 : role === "ruler" ? 1.04 : 1;
  root.scale.setScalar(scale);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return { root, cape, weapon, glow, metals };
}

export function poseFigurine(parts: FigParts, time: number, moving: boolean, action: string, actionAge: number): void {
  const bob = Math.sin(time * (moving ? 9 : 2.2)) * (moving ? 0.045 : 0.02);
  parts.root.position.y = bob;
  parts.cape.rotation.x = 0.08 + Math.sin(time * 1.7) * 0.05 + (moving ? 0.18 : 0);
  parts.cape.rotation.z = Math.sin(time * 1.3) * 0.04;
  const swing = action === "attack" || action === "heavy"
    ? Math.sin(Math.min(1, actionAge / 0.28) * Math.PI) * (action === "heavy" ? 1.7 : 1.15)
    : Math.sin(time * 1.4) * 0.08;
  parts.weapon.rotation.z = -0.4 - swing;
  parts.weapon.rotation.x = action === "cast" ? -0.8 : 0.2;
  if (action === "hit") parts.root.rotation.z = Math.sin(actionAge * 40) * 0.08;
  else parts.root.rotation.z *= 0.8;
  const flash = action === "hit" && actionAge < 0.12 ? 1.8 : 0.55;
  parts.glow.forEach((mat) => {
    mat.emissiveIntensity = flash;
  });
}

export class RealmStage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
  readonly renderer: THREE.WebGLRenderer;
  readonly player: FigParts;
  private readonly owned: THREE.Material[] = [];
  private readonly clockOffset = Math.random() * 10;
  shrineGlow: THREE.MeshStandardMaterial | null = null;
  wellMats: THREE.MeshStandardMaterial[] = [];
  private readonly sun: THREE.DirectionalLight;
  private reduced: boolean;

  constructor(readonly canvas: HTMLCanvasElement, civ: Civilization, reduced: boolean) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !reduced, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !reduced;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(civ.palette.ground, 1);

    const skyTex = realmLibrary().sky;
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      color: liftColor(civ.palette.primary, "#efe6da", 0.72),
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.owned.push(skyMat);
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(70, 28, 18), skyMat));

    const hemi = new THREE.HemisphereLight(civ.palette.glow, civ.palette.ground, 0.7);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight("#fff1d6", 2.15);
    this.sun.position.set(-8, 16, 8);
    this.sun.castShadow = !reduced;
    this.sun.shadow.mapSize.set(reduced ? 512 : 2048, reduced ? 512 : 2048);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 40;
    this.sun.shadow.camera.left = -18;
    this.sun.shadow.camera.right = 18;
    this.sun.shadow.camera.top = 18;
    this.sun.shadow.camera.bottom = -18;
    this.scene.add(this.sun);
    const rim = new THREE.PointLight(civ.palette.primary, 8, 28, 2);
    rim.position.set(6, 4, -8);
    this.scene.add(rim);

    this.scene.fog = new THREE.Fog(civ.palette.ground, 16, 46);
    this.buildTerrain(civ);
    this.dress(civ.family, civ);
    this.placeObjectives(civ);

    this.player = buildFigurine(civ, "ruler");
    this.player.root.position.set(0, 0, 6);
    this.scene.add(this.player.root);
    this.camera.position.set(0, 15.2, 22);
    this.camera.lookAt(0, 1, 6);
    this.fit();
  }

  private buildTerrain(civ: Civilization): void {
    const template = realmLibrary().props.get("terrain");
    if (!template) return;
    const terrain = cloneModel(template);
    tintPlace(terrain, civ);
    terrain.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.receiveShadow = true;
        mesh.castShadow = false;
      }
    });
    this.scene.add(terrain);
  }

  private dress(family: Family, civ: Civilization): void {
    const rand = mulberry(civ.index * 97 + family.length * 13);
    const sites: Record<Family, ReadonlyArray<readonly [string, number, number]>> = {
      grove: [
        ["tree", -12.4, 7.1], ["tree_b", -10.2, 9.6], ["tree", -13.8, 4.4], ["roots", -8.6, 8.2],
        ["tree", 13.2, -5.4], ["tree_b", 11.4, -8.8], ["boulder", 7.8, 11.6], ["boulder", -5.5, -13.2],
        ["tuft", 4.2, 10.4], ["tuft", -3.1, -10.6], ["tuft", 10.2, 3.6], ["roots", 5.4, -12.1],
        ["tuft", -14.2, -2.4],
      ],
      basilica: [
        ["arch", -11.6, 6.8], ["arch", 12.4, 4.2], ["arch", 8.8, -11.5], ["banner", -9.2, -6.4],
        ["banner", 4.6, 12.8], ["cairn", -6.8, 12.2], ["cairn", 13.6, -2.2], ["boulder_b", -13.4, -6.6],
        ["boulder_b", 2.8, -13.4], ["tuft", 6.2, 8.4], ["tuft", -4.4, -8.8],
      ],
      foundry: [
        ["stack", -12.2, 5.5], ["stack", 11.8, -7.4], ["stack", 6.4, 12.6], ["boulder", -8.4, -11.2],
        ["boulder", 13.5, 3.2], ["boulder", -4.6, 13.4], ["cairn", 9.2, 8.8], ["boulder_b", -13.8, -1.4],
        ["boulder_b", 3.4, -12.2],
      ],
      observatory: [
        ["spire", -10.8, 8.4], ["spire", 13.2, -3.6], ["spire", 5.5, -13.1], ["spire", -14.2, -4.8],
        ["boulder", 9.4, 10.2], ["cairn", -6.2, -12.4], ["cairn", 12.6, 7.4], ["tuft", -3.8, 11.2],
        ["tuft", 7.2, -8.6],
      ],
      monolith: [
        ["monolith", -11.4, 6.2], ["monolith", -13.6, -2.8], ["monolith", 10.8, 9.4], ["monolith", 12.6, -6.6],
        ["monolith", 4.2, -13.6], ["cairn", -7.4, -11.8], ["cairn", 8.2, -10.4], ["boulder", -5.2, 13.2],
        ["boulder_b", 14.1, 1.6], ["boulder_b", -9.6, 11.4],
      ],
    };
    sites[family].forEach(([name, x, z]) => {
      const template = realmLibrary().props.get(name);
      if (!template) return;
      const prop = cloneModel(template);
      const jx = (rand() - 0.5) * 1.6;
      const jz = (rand() - 0.5) * 1.6;
      prop.position.set(x + jx, -0.08 - rand() * 0.18, z + jz);
      prop.rotation.y = rand() * Math.PI * 2;
      prop.rotation.z = (rand() - 0.5) * 0.18;
      prop.rotation.x = (rand() - 0.5) * 0.14;
      prop.scale.set(0.75 + rand() * 0.55, 0.7 + rand() * 0.6, 0.75 + rand() * 0.5);
      tintPlace(prop, civ);
      prop.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = !this.reduced;
          mesh.receiveShadow = true;
        }
      });
      this.scene.add(prop);
    });
  }

  private placeObjectives(civ: Civilization): void {
    const lib = realmLibrary();
    const shrineSrc = lib.props.get("shrine");
    if (shrineSrc) {
      const shrine = cloneModel(shrineSrc);
      tintPlace(shrine, civ);
      shrine.position.set(0, 0, 0);
      shrine.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = !this.reduced;
          mesh.receiveShadow = true;
        }
      });
      eachMaterial(shrine, (material, name) => {
        if (name === "Trim" && !this.shrineGlow) this.shrineGlow = material;
      });
      this.scene.add(shrine);
    }
    const wellSrc = lib.props.get("well");
    [[-7, 4.6], [7.2, -3.8]].forEach(([x, z]) => {
      if (!wellSrc) return;
      const well = cloneModel(wellSrc);
      tintPlace(well, civ);
      well.position.set(x, 0, z);
      well.rotation.y = x;
      let found = false;
      eachMaterial(well, (material, name) => {
        if (name === "Well" && !found) {
          this.wellMats.push(material);
          found = true;
        }
      });
      if (!found) {
        const dummy = new THREE.MeshStandardMaterial({ emissive: civ.palette.primary });
        this.wellMats.push(dummy);
        this.owned.push(dummy);
      }
      well.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = !this.reduced;
          mesh.receiveShadow = true;
        }
      });
      this.scene.add(well);
    });
  }

  addActor(parts: FigParts): void {
    this.scene.add(parts.root);
  }

  removeActor(parts: FigParts): void {
    this.scene.remove(parts.root);
    const seen = new Set<THREE.Material>();
    parts.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!seen.has(mat)) {
          seen.add(mat);
          mat.dispose();
        }
      });
    });
  }

  burst(x: number, z: number, color: string, scale = 1): void {
    const mesh = new THREE.Mesh(
      burstRing,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.08, z);
    mesh.scale.setScalar(0.15 * scale);
    mesh.userData["ttl"] = 0.45;
    mesh.userData["life"] = 0.45;
    this.scene.add(mesh);
  }

  updateFx(dt: number): void {
    const dying: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (obj.userData["ttl"] == null) return;
      obj.userData["ttl"] -= dt;
      const mesh = obj as THREE.Mesh;
      const life = obj.userData["life"] as number;
      const k = 1 - obj.userData["ttl"] / life;
      mesh.scale.setScalar(0.2 + k * 2.4);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat?.opacity != null) mat.opacity = 0.8 * (1 - k);
      if (obj.userData["ttl"] <= 0) dying.push(obj);
    });
    dying.forEach((obj) => {
      this.scene.remove(obj);
      const mesh = obj as THREE.Mesh;
      (mesh.material as THREE.Material | undefined)?.dispose();
    });
  }

  fit(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.reduced ? 1.25 : 1.7));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(target: THREE.Vector3, shakeX: number, shakeY: number, time: number, dt: number): void {
    const look = target.clone();
    look.y = 1.1;
    const desired = new THREE.Vector3(look.x + shakeX, 15.2 + shakeY, look.z + 16.4);
    this.camera.position.lerp(desired, 1 - Math.exp(-4.2 * Math.max(0.001, dt)));
    this.camera.lookAt(look);
    this.sun.position.set(look.x - 8, 16, look.z + 6);
    this.sun.target.position.copy(look);
    this.sun.target.updateMatrixWorld();
    if (this.shrineGlow) this.shrineGlow.emissiveIntensity = 0.45 + Math.sin(time * 2) * 0.2;
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
    const seen = new Set<THREE.Material>();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!seen.has(mat)) {
          seen.add(mat);
          mat.dispose();
        }
      });
    });
    this.renderer.dispose();
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
