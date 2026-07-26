import * as THREE from 'three';

type Shockwave = { mesh: THREE.Mesh; age: number; life: number; radius: number };
type Spark = { sprite: THREE.Sprite; velocity: THREE.Vector3; age: number; life: number; drag: number };
type Slash = { mesh: THREE.Mesh; age: number; life: number; travel: number };
type Flash = { light: THREE.PointLight; age: number; life: number; peak: number };
export type Telegraph = { mesh: THREE.Mesh; age: number; life: number; radius: number; active: boolean };

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 45);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(.12, 'rgba(255,255,255,.98)');
  gradient.addColorStop(.38, 'rgba(255,255,255,.42)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  return new THREE.CanvasTexture(canvas);
}

function streakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(.72, 'rgba(255,255,255,.65)');
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 32);
  return new THREE.CanvasTexture(canvas);
}

export class BattlefieldVfx {
  private readonly root = new THREE.Group();
  private readonly waves: Shockwave[] = [];
  private readonly sparks: Spark[] = [];
  private readonly slashes: Slash[] = [];
  private readonly flashes: Flash[] = [];
  private readonly telegraphs: Telegraph[] = [];
  private readonly texture = glowTexture();
  private readonly streak = streakTexture();
  private sequence = 1;

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'Battlefield VFX';
    scene.add(this.root);
  }

  burst(position: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, intensity = 1): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.18, .31, 72),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: .92,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position).setY(.085);
    this.root.add(ring);
    this.waves.push({ mesh: ring, age: 0, life: .5 + intensity * .12, radius });

    const flash = new THREE.PointLight(color, 0, 7 + radius * 2, 2);
    flash.position.copy(position).add(new THREE.Vector3(0, .7, 0));
    this.root.add(flash);
    this.flashes.push({ light: flash, age: 0, life: .16 + intensity * .04, peak: 8 + intensity * 7 });

    const rand = mulberry(this.sequence++ * 7919);
    const count = Math.min(44, 12 + Math.round(intensity * 11));
    for (let index = 0; index < count; index += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: index % 3 === 0 ? this.streak : this.texture,
        color,
        transparent: true,
        opacity: .95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      sprite.position.copy(position).add(new THREE.Vector3((rand() - .5) * .5, .22 + rand() * .58, (rand() - .5) * .5));
      sprite.scale.set(index % 3 === 0 ? .48 : .12 + rand() * .2, .09 + rand() * .12, 1);
      this.root.add(sprite);
      const angle = rand() * Math.PI * 2;
      const force = 1.5 + rand() * 3.1 * intensity;
      this.sparks.push({
        sprite,
        velocity: new THREE.Vector3(Math.cos(angle) * force, 1.3 + rand() * 2.9, Math.sin(angle) * force),
        age: 0,
        life: .34 + rand() * .5,
        drag: 1.2 + rand() * 1.2,
      });
    }
  }

  slash(position: THREE.Vector3, yaw: number, color: THREE.ColorRepresentation, combo = 0): void {
    const geometry = new THREE.RingGeometry(.55 + combo * .09, 1.2 + combo * .16, 64, 1, -.9, 1.8);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: .92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position).add(new THREE.Vector3(0, .72, 0));
    mesh.rotation.set(-Math.PI / 2, 0, -yaw + (combo % 2 === 0 ? -.9 : .3));
    this.root.add(mesh);
    this.slashes.push({ mesh, age: 0, life: .22 + combo * .025, travel: .38 + combo * .08 });
  }

  trail(position: THREE.Vector3, color: THREE.ColorRepresentation, size = .15): void {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.texture,
      color,
      transparent: true,
      opacity: .62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    sprite.position.copy(position).add(new THREE.Vector3(0, .18, 0));
    sprite.scale.setScalar(size);
    this.root.add(sprite);
    this.sparks.push({ sprite, velocity: new THREE.Vector3(0, .24, 0), age: 0, life: .22, drag: 4 });
  }

  telegraph(position: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, life = .75): Telegraph {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: .18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 72), material);
    mesh.position.copy(position).setY(.075);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(radius);
    this.root.add(mesh);
    const telegraph = { mesh, age: 0, life, radius, active: true };
    this.telegraphs.push(telegraph);
    return telegraph;
  }

  cancelTelegraph(telegraph?: Telegraph): void {
    if (!telegraph?.active) return;
    telegraph.active = false;
    this.root.remove(telegraph.mesh);
    telegraph.mesh.geometry.dispose();
    (telegraph.mesh.material as THREE.Material).dispose();
    const index = this.telegraphs.indexOf(telegraph);
    if (index >= 0) this.telegraphs.splice(index, 1);
  }

  update(delta: number): void {
    for (let i = this.waves.length - 1; i >= 0; i -= 1) {
      const wave = this.waves[i];
      wave.age += delta;
      const t = Math.min(1, wave.age / wave.life);
      wave.mesh.scale.setScalar(1 + wave.radius * (1 - Math.pow(1 - t, 3)) * 2.15);
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * .92;
      if (t >= 1) {
        this.root.remove(wave.mesh);
        wave.mesh.geometry.dispose();
        (wave.mesh.material as THREE.Material).dispose();
        this.waves.splice(i, 1);
      }
    }

    for (let i = this.slashes.length - 1; i >= 0; i -= 1) {
      const slash = this.slashes[i];
      slash.age += delta;
      const t = Math.min(1, slash.age / slash.life);
      slash.mesh.scale.setScalar(.72 + t * slash.travel);
      slash.mesh.position.y += delta * .65;
      (slash.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * .88;
      if (t >= 1) {
        this.root.remove(slash.mesh);
        slash.mesh.geometry.dispose();
        (slash.mesh.material as THREE.Material).dispose();
        this.slashes.splice(i, 1);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      spark.age += delta;
      const t = spark.age / spark.life;
      spark.velocity.multiplyScalar(Math.max(0, 1 - spark.drag * delta));
      spark.velocity.y -= 5.8 * delta;
      spark.sprite.position.addScaledVector(spark.velocity, delta);
      spark.sprite.material.opacity = Math.max(0, (1 - t) * .92);
      spark.sprite.scale.multiplyScalar(Math.max(.8, 1 - delta * .9));
      if (t >= 1) {
        this.root.remove(spark.sprite);
        spark.sprite.material.dispose();
        this.sparks.splice(i, 1);
      }
    }

    for (let i = this.flashes.length - 1; i >= 0; i -= 1) {
      const flash = this.flashes[i];
      flash.age += delta;
      const t = flash.age / flash.life;
      flash.light.intensity = Math.sin(Math.min(1, t) * Math.PI) * flash.peak;
      if (t >= 1) {
        this.root.remove(flash.light);
        flash.light.dispose();
        this.flashes.splice(i, 1);
      }
    }

    for (let i = this.telegraphs.length - 1; i >= 0; i -= 1) {
      const telegraph = this.telegraphs[i];
      telegraph.age += delta;
      const t = Math.min(1, telegraph.age / telegraph.life);
      telegraph.mesh.rotation.z += delta * (2.2 + t * 4.5);
      telegraph.mesh.scale.setScalar(telegraph.radius * (.96 + Math.sin(t * Math.PI * 8) * .025));
      (telegraph.mesh.material as THREE.MeshBasicMaterial).opacity = .16 + t * .58;
      if (t >= 1) this.cancelTelegraph(telegraph);
    }
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
      if (object instanceof THREE.Sprite) object.material.dispose();
      if (object instanceof THREE.Light) object.dispose();
    });
    this.texture.dispose();
    this.streak.dispose();
  }
}

function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
