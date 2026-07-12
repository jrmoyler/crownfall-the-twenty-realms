export class RealmAudio {
  private context?: AudioContext;
  private master?: GainNode;
  constructor(private readonly muted: () => boolean) {}

  cue(kind: 'strike' | 'cast' | 'summon' | 'hit'): void {
    if (this.muted()) return;
    const context = this.context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    let master = this.master;
    if (!master) { master = context.createGain(); master.connect(context.destination); this.master = master; }
    master.gain.setValueAtTime(.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(kind === 'hit' ? .09 : .16, context.currentTime + .015);
    master.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .3);
    const oscillator = context.createOscillator(); const filter = context.createBiquadFilter();
    oscillator.type = kind === 'summon' ? 'sine' : kind === 'cast' ? 'triangle' : 'sawtooth';
    oscillator.frequency.setValueAtTime(kind === 'strike' ? 190 : kind === 'hit' ? 95 : kind === 'summon' ? 135 : 310, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'summon' ? 420 : 62, context.currentTime + .28);
    filter.type = 'lowpass'; filter.frequency.value = kind === 'cast' ? 1800 : 850;
    oscillator.connect(filter).connect(master); oscillator.start(); oscillator.stop(context.currentTime + .31);
  }

  dispose(): void { void this.context?.close(); this.context = undefined; this.master = undefined; }
}
