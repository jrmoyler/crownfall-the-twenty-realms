import * as THREE from "three";
import type { Civilization, EnemyRole, Family, WeaponKind } from "./types";

export interface FigParts {
  root: THREE.Group;
  cape: THREE.Mesh;
  weapon: THREE.Group;
  glow: THREE.MeshStandardMaterial[];
  metals: THREE.MeshStandardMaterial[];
}

const GEO = {
  shadow: new THREE.CircleGeometry(0.55, 20),
  robe: new THREE.CapsuleGeometry(0.28, 0.55, 5, 10),
  plate: new THREE.BoxGeometry(0.46, 0.32, 0.22),
  belt: new THREE.TorusGeometry(0.2, 0.035, 6, 14),
  shoulder: new THREE.SphereGeometry(0.13, 10, 8),
  head: new THREE.SphereGeometry(0.16, 16, 12),
  crownBand: new THREE.TorusGeometry(0.15, 0.028, 6, 16),
  spike: new THREE.ConeGeometry(0.04, 0.22, 5),
  horn: new THREE.ConeGeometry(0.05, 0.28, 6),
  halo: new THREE.TorusGeometry(0.26, 0.02, 6, 24),
  cape: new THREE.PlaneGeometry(0.7, 1.05, 3, 5),
  shaft: new THREE.CylinderGeometry(0.03, 0.038, 1.35, 7),
  orb: new THREE.SphereGeometry(0.12, 12, 10),
  hammer: new THREE.BoxGeometry(0.38, 0.18, 0.18),
  blade: new THREE.BoxGeometry(0.08, 0.78, 0.03),
  tip: new THREE.ConeGeometry(0.07, 0.32, 6),
  gem: new THREE.OctahedronGeometry(0.08, 0),
  tree: new THREE.ConeGeometry(0.55, 1.6, 6),
  trunk: new THREE.CylinderGeometry(0.08, 0.1, 0.45, 5),
  pillar: new THREE.CylinderGeometry(0.18, 0.22, 2.4, 7),
  rock: new THREE.DodecahedronGeometry(0.45, 0),
  arch: new THREE.TorusGeometry(0.7, 0.08, 6, 10, Math.PI),
  banner: new THREE.PlaneGeometry(0.28, 0.7),
  ring: new THREE.RingGeometry(1.6, 1.72, 48),
  well: new THREE.CylinderGeometry(0.7, 0.8, 0.35, 10),
  shrine: new THREE.CylinderGeometry(0.35, 0.5, 1.6, 8),
  beam: new THREE.CylinderGeometry(0.04, 0.04, 6, 6),
};

function noiseCanvas(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d")!;
  const image = g.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 140 + Math.random() * 115;
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let sharedRough: THREE.CanvasTexture | null = null;

function roughMap(): THREE.CanvasTexture {
  if (!sharedRough) sharedRough = noiseCanvas(128);
  return sharedRough;
}

function paintGround(civ: Civilization): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const g = canvas.getContext("2d")!;
  g.fillStyle = civ.palette.ground;
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 1800; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const w = 8 + Math.random() * 40;
    g.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.04})`;
    g.fillRect(x, y, w, 2 + Math.random() * 6);
  }
  g.strokeStyle = "rgba(198,161,90,0.35)";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(512, 512, 150, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(512, 512, 280, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2;
    g.beginPath();
    g.moveTo(512 + Math.cos(a) * 150, 512 + Math.sin(a) * 150);
    g.lineTo(512 + Math.cos(a) * 300, 512 + Math.sin(a) * 300);
    g.stroke();
  }
  g.strokeStyle = civ.palette.primary;
  g.globalAlpha = 0.25;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(512, 512, 90, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function paintSky(civ: Civilization): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  const gradient = g.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#07060c");
  gradient.addColorStop(0.45, civ.palette.ground);
  gradient.addColorStop(0.72, civ.palette.primary);
  gradient.addColorStop(1, "#1a120c");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = "rgba(255,236,190,0.85)";
  g.beginPath();
  g.arc(32, 78, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = civ.palette.ground;
  g.beginPath();
  g.arc(36, 76, 9, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function metal(color: string, emissive = "#000000", intensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    metalness: 0.72,
    roughness: 0.38,
    roughnessMap: roughMap(),
  });
}

function cloth(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.08,
    roughness: 0.86,
    roughnessMap: roughMap(),
    side: THREE.DoubleSide,
  });
}

export function buildFigurine(
  civ: Civilization,
  role: "ruler" | EnemyRole | "boss" | "ally",
  boss = false,
): FigParts {
  const root = new THREE.Group();
  const glowMats: THREE.MeshStandardMaterial[] = [];
  const metals: THREE.MeshStandardMaterial[] = [];
  const steel = metal(civ.palette.metal);
  const trim = metal(civ.palette.glow, civ.palette.glow, 0.55);
  const plate = metal(civ.palette.primary, civ.palette.primary, 0.18);
  const robeMat = cloth(civ.palette.cloth);
  metals.push(steel, plate);
  glowMats.push(trim);

  const shadow = new THREE.Mesh(
    GEO.shadow,
    new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const cape = new THREE.Mesh(GEO.cape, robeMat);
  cape.position.set(0, 0.95, -0.16);
  root.add(cape);

  const robe = new THREE.Mesh(GEO.robe, robeMat);
  robe.position.y = 0.85;
  root.add(robe);

  const breast = new THREE.Mesh(GEO.plate, plate);
  breast.position.y = 1.05;
  breast.castShadow = true;
  root.add(breast);

  const belt = new THREE.Mesh(GEO.belt, steel);
  belt.position.y = 0.78;
  belt.rotation.x = Math.PI / 2;
  root.add(belt);

  const scale = role === "brute" || boss ? 1.15 : role === "skirmisher" || role === "ally" ? 0.82 : role === "mystic" ? 0.9 : 1;
  [-1, 1].forEach((side) => {
    const shoulder = new THREE.Mesh(GEO.shoulder, steel);
    shoulder.position.set(0.28 * side, 1.22, 0);
    shoulder.scale.setScalar(role === "brute" || boss ? 1.35 : 1);
    root.add(shoulder);
  });

  const head = new THREE.Mesh(GEO.head, cloth("#d8c3a5"));
  head.position.y = 1.48;
  head.castShadow = true;
  root.add(head);

  const eye = new THREE.Mesh(GEO.gem, trim);
  eye.position.set(0, 1.5, 0.12);
  eye.scale.set(0.35, 0.18, 0.2);
  root.add(eye);

  crownFor(root, civ.index, steel, trim, boss || role === "ruler");

  const weapon = weaponFor(civ.weapon, steel, trim, plate);
  weapon.position.set(0.34, 1.05, 0.08);
  root.add(weapon);

  if (boss) {
    const halo = new THREE.Mesh(GEO.halo, trim);
    halo.position.y = 1.78;
    halo.rotation.x = Math.PI / 2;
    root.add(halo);
  }

  root.scale.setScalar(boss ? scale * 1.28 : role === "ruler" ? 1.05 : scale);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = mesh.geometry !== GEO.shadow && mesh.geometry !== GEO.cape;
      mesh.receiveShadow = true;
    }
  });
  return { root, cape, weapon, glow: glowMats, metals };
}

function crownFor(root: THREE.Group, index: number, steel: THREE.Material, trim: THREE.Material, hero: boolean): void {
  const kind = index % 5;
  if (!hero && kind !== 0) {
    const band = new THREE.Mesh(GEO.crownBand, steel);
    band.position.y = 1.64;
    band.rotation.x = Math.PI / 2;
    root.add(band);
    return;
  }
  if (kind === 0 || kind === 1) {
    const band = new THREE.Mesh(GEO.crownBand, kind === 0 ? trim : steel);
    band.position.y = 1.64;
    band.rotation.x = Math.PI / 2;
    root.add(band);
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(GEO.spike, trim);
      const a = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.13, 1.74, Math.sin(a) * 0.13);
      root.add(spike);
    }
  } else if (kind === 2) {
    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(GEO.horn, steel);
      horn.position.set(0.12 * side, 1.62, 0);
      horn.rotation.z = -0.7 * side;
      root.add(horn);
    });
  } else if (kind === 3) {
    const halo = new THREE.Mesh(GEO.halo, trim);
    halo.position.y = 1.72;
    halo.rotation.x = Math.PI / 2.4;
    root.add(halo);
  } else {
    const hood = new THREE.Mesh(GEO.head, clothShade(trim));
    hood.position.y = 1.55;
    hood.scale.set(1.25, 1.35, 1.2);
    root.add(hood);
  }
}

function clothShade(source: THREE.Material): THREE.Material {
  const color = (source as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color("#222");
  return cloth(`#${color.getHexString()}`);
}

function weaponFor(kind: WeaponKind, steel: THREE.Material, trim: THREE.Material, plate: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  if (kind === "hammer") {
    const shaft = new THREE.Mesh(GEO.shaft, steel);
    shaft.scale.set(0.8, 0.85, 0.8);
    const head = new THREE.Mesh(GEO.hammer, plate);
    head.position.y = 0.62;
    group.add(shaft, head);
  } else if (kind === "blade" || kind === "glaive") {
    const shaft = new THREE.Mesh(GEO.shaft, steel);
    shaft.scale.set(0.45, 0.35, 0.45);
    shaft.position.y = -0.15;
    const blade = new THREE.Mesh(GEO.blade, trim);
    blade.position.y = 0.35;
    blade.scale.x = kind === "glaive" ? 1.4 : 1;
    group.add(shaft, blade);
  } else if (kind === "spear") {
    const shaft = new THREE.Mesh(GEO.shaft, steel);
    shaft.scale.y = 1.25;
    const tip = new THREE.Mesh(GEO.tip, trim);
    tip.position.y = 0.95;
    group.add(shaft, tip);
  } else if (kind === "orb") {
    const shaft = new THREE.Mesh(GEO.shaft, steel);
    shaft.scale.set(0.7, 0.7, 0.7);
    const orb = new THREE.Mesh(GEO.orb, trim);
    orb.position.y = 0.62;
    group.add(shaft, orb);
  } else {
    const shaft = new THREE.Mesh(GEO.shaft, steel);
    const gem = new THREE.Mesh(GEO.gem, trim);
    gem.position.y = 0.78;
    group.add(shaft, gem);
  }
  return group;
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
  private readonly ownedTex: THREE.Texture[] = [];
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

    const skyTex = paintSky(civ);
    this.ownedTex.push(skyTex);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(70, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false }),
    );
    this.scene.add(sky);

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
    const geo = new THREE.PlaneGeometry(46, 46, 48, 48);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const n = Math.sin(x * 0.35) * Math.cos(z * 0.28) * 0.35 + Math.sin(x * 0.9 + z) * 0.08;
      const flatten = THREE.MathUtils.smoothstep(d, 8, 16);
      const rim = THREE.MathUtils.smoothstep(d, 15, 21) * 1.6;
      pos.setY(i, n * flatten + rim);
    }
    geo.computeVertexNormals();
    const map = paintGround(civ);
    this.ownedTex.push(map);
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0.08, roughnessMap: roughMap() });
    this.owned.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const ring = new THREE.Mesh(
      GEO.ring,
      new THREE.MeshBasicMaterial({ color: "#c6a15a", transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.scale.setScalar(1.15);
    this.scene.add(ring);
  }

  private dress(family: Family, civ: Civilization): void {
    const stone = metal(civ.palette.metal);
    const leaf = cloth(civ.palette.primary);
    this.owned.push(stone, leaf);
    const count = family === "grove" ? 16 : 10;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + 0.2;
      const r = 11.5 + (i % 3) * 0.8;
      const group = new THREE.Group();
      group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      group.rotation.y = -a;
      if (family === "grove") {
        const trunk = new THREE.Mesh(GEO.trunk, stone);
        trunk.position.y = 0.22;
        const top = new THREE.Mesh(GEO.tree, leaf);
        top.position.y = 1.15;
        group.add(trunk, top);
      } else if (family === "basilica") {
        const arch = new THREE.Mesh(GEO.arch, stone);
        arch.position.y = 0.7;
        const banner = new THREE.Mesh(GEO.banner, cloth(civ.palette.glow));
        banner.position.set(0, 0.85, 0.05);
        group.add(arch, banner);
      } else if (family === "foundry") {
        const stack = new THREE.Mesh(GEO.pillar, stone);
        stack.scale.set(0.7, 0.8, 0.7);
        stack.position.y = 0.9;
        const rock = new THREE.Mesh(GEO.rock, stone);
        rock.position.set(0.5, 0.25, 0.2);
        group.add(stack, rock);
      } else if (family === "observatory") {
        const pillar = new THREE.Mesh(GEO.pillar, stone);
        pillar.scale.set(0.45, 1, 0.45);
        pillar.position.y = 1.2;
        const ring = new THREE.Mesh(GEO.halo, metal(civ.palette.glow, civ.palette.glow, 0.4));
        ring.position.y = 2.3;
        ring.rotation.x = Math.PI / 2;
        group.add(pillar, ring);
      } else {
        const stoneMesh = new THREE.Mesh(GEO.pillar, stone);
        stoneMesh.scale.set(0.55, 0.7 + (i % 3) * 0.15, 0.35);
        stoneMesh.position.y = 0.8;
        group.add(stoneMesh);
      }
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = !this.reduced;
          mesh.receiveShadow = true;
        }
      });
      this.scene.add(group);
    }
  }

  private placeObjectives(civ: Civilization): void {
    const shrineMat = metal(civ.palette.glow, civ.palette.glow, 0.8);
    this.shrineGlow = shrineMat;
    this.owned.push(shrineMat);
    const shrine = new THREE.Mesh(GEO.shrine, shrineMat);
    shrine.position.set(0, 0.8, 0);
    shrine.castShadow = true;
    const cap = new THREE.Mesh(GEO.gem, shrineMat);
    cap.position.set(0, 1.8, 0);
    cap.scale.setScalar(2.2);
    const beam = new THREE.Mesh(
      GEO.beam,
      new THREE.MeshBasicMaterial({ color: civ.palette.glow, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    beam.position.set(0, 3.2, 0);
    this.scene.add(shrine, cap, beam);

    [[-7, 4.6], [7.2, -3.8]].forEach(([x, z]) => {
      const mat = metal(civ.palette.primary, civ.palette.primary, 0.25);
      this.wellMats.push(mat);
      this.owned.push(mat);
      const well = new THREE.Mesh(GEO.well, mat);
      well.position.set(x!, 0.18, z!);
      const marker = new THREE.Mesh(GEO.beam, new THREE.MeshBasicMaterial({
        color: civ.palette.primary, transparent: true, opacity: 0.14, depthWrite: false,
      }));
      marker.position.set(x!, 3, z!);
      this.scene.add(well, marker);
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
      GEO.ring,
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
    this.ownedTex.forEach((tex) => tex.dispose());
  }
}
