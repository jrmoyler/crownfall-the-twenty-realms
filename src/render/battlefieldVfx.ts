import * as THREE from 'three';

type Shockwave = { mesh: THREE.Mesh; age: number; life: number; radius: number };
type Spark = { sprite: THREE.Sprite; velocity: THREE.Vector3; age: number; life: number };

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.18, 'rgba(255,255,255,.95)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export class BattlefieldVfx {
  private readonly root = new THREE.Group();
  private readonly waves: Shockwave[] = [];
  private readonly sparks: Spark[] = [];
  private readonly texture = glowTexture();
  private sequence = 1;

  constructor(private readonly scene: THREE.Scene) { scene.add(this.root); }

  burst(position: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, intensity = 1): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.2, .28, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .88, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.copy(position).setY(.09); this.root.add(ring);
    this.waves.push({ mesh: ring, age: 0, life: .55 + intensity * .12, radius });
    const rand = mulberry(this.sequence++ * 7919);
    const count = Math.min(28, 9 + Math.round(intensity * 8));
    for (let index = 0; index < count; index += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, color, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
      sprite.position.copy(position).add(new THREE.Vector3((rand() - .5) * .6, .25 + rand() * .55, (rand() - .5) * .6));
      sprite.scale.setScalar(.12 + rand() * .18); this.root.add(sprite);
      const angle = rand() * Math.PI * 2; const force = 1.3 + rand() * 2.8 * intensity;
      this.sparks.push({ sprite, velocity: new THREE.Vector3(Math.cos(angle) * force, 1.6 + rand() * 2.6, Math.sin(angle) * force), age: 0, life: .35 + rand() * .48 });
    }
  }

  update(delta: number): void {
    for (let i = this.waves.length - 1; i >= 0; i -= 1) {
      const wave = this.waves[i]; wave.age += delta; const t = Math.min(1, wave.age / wave.life);
      wave.mesh.scale.setScalar(1 + wave.radius * (1 - Math.pow(1 - t, 3)) * 2.3);
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * .88;
      if (t >= 1) { this.root.remove(wave.mesh); wave.mesh.geometry.dispose(); (wave.mesh.material as THREE.Material).dispose(); this.waves.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i]; spark.age += delta; const t = spark.age / spark.life;
      spark.velocity.y -= 6.8 * delta; spark.sprite.position.addScaledVector(spark.velocity, delta);
      spark.sprite.material.opacity = Math.max(0, 1 - t); spark.sprite.scale.multiplyScalar(1 - delta * .65);
      if (t >= 1) { this.root.remove(spark.sprite); spark.sprite.material.dispose(); this.sparks.splice(i, 1); }
    }
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.root.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } if (object instanceof THREE.Sprite) object.material.dispose(); });
    this.texture.dispose();
  }
}

function mulberry(seed: number): () => number { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
