import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type VisualTier = 'cinematic' | 'balanced' | 'battery';

function chooseTier(): VisualTier {
  const requested = new URLSearchParams(location.search).get('quality');
  if (requested === 'cinematic' || requested === 'balanced' || requested === 'battery') return requested;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 8;
  return memory <= 4 || cores <= 4 ? 'battery' : matchMedia('(pointer: coarse)').matches ? 'balanced' : 'cinematic';
}

export class CinematicPipeline {
  readonly tier = chooseTier();
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private baseline = new URLSearchParams(location.search).get('visual') === 'baseline';
  private averageFrame = 1 / 60;
  private slowFrames = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), this.tier === 'cinematic' ? .48 : .32, .58, 1.08);
    this.bloom.enabled = !this.baseline && this.tier !== 'battery';
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    window.addEventListener('keydown', this.onDebugKey);
  }

  private readonly onDebugKey = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() !== 'p') return;
    this.baseline = !this.baseline;
    this.bloom.enabled = !this.baseline && this.tier !== 'battery';
  };

  render(delta: number): void {
    this.averageFrame = THREE.MathUtils.lerp(this.averageFrame, delta, .035);
    if (this.averageFrame > 1 / 42) this.slowFrames += 1;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 90) {
      this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() * .85));
      this.slowFrames = 0;
    }
    this.composer.render(delta);
  }

  resize(width: number, height: number): void {
    this.composer.setSize(Math.max(1, width), Math.max(1, height));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDebugKey);
    this.composer.dispose();
  }
}
