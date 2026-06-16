/**
 * NewJeans Y2K Synth Audio Engine
 * Procedurally generates retro Y2K-style chiptune/synth-pop background music
 * and arcade sound effects using the Web Audio API. No external mp3 files required!
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.isMuted = false;
    this.bgmIntervalId = null;
    this.isPlayingBgm = false;
    this.tempo = 120; // BPM
    this.stepTime = 60 / this.tempo / 2; // Eighth notes
    this.currentStep = 0;
  }

  init() {
    if (this.ctx) return;
    
    // Create Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create Gain Nodes
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    
    // Connections
    this.masterGain.connect(this.ctx.destination);
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    
    // Default volumes
    this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.sfxGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.5, this.ctx ? this.ctx.currentTime : 0);
    }
    return this.isMuted;
  }

  // SOUND EFFECTS (SFX)
  playJump() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    osc.type = 'triangle';
    
    // Quick pitch sweep upwards
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    
    // Volume envelope
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playCollect() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Play a cute 2-note arpeggio (sweet Y2K sound)
    const playNote = (freq, delay, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gain.gain.setValueAtTime(0.15, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + duration);
      
      osc.start(now + delay);
      osc.stop(now + delay + duration);
    };

    playNote(523.25, 0, 0.1); // C5
    playNote(659.25, 0.06, 0.15); // E5
    playNote(783.99, 0.12, 0.2); // G5
  }

  playHit() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    osc.type = 'sawtooth';
    
    // Pitch plunge
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.25);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  playSkill() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Generate an ascending futuristic retro scale (laser chiptune)
    const notes = [440, 554, 659, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      
      gain.gain.setValueAtTime(0.15, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.15);
      
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.15);
    });
  }

  playYahoo() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    
    // "Ya" chirp
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(380, now);
    osc1.frequency.exponentialRampToValueAtTime(480, now + 0.07);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // "hoo!" slide
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(540, now + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(700, now + 0.22);
    gain2.gain.setValueAtTime(0.15, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.26);
  }

  // MUSIC ENGINE (BGM)
  startBgm() {
    this.resume();
    if (this.isPlayingBgm) return;
    this.isPlayingBgm = true;

    // A cute pentatonic retro synthpop bassline & lead loop
    // 4 Chords: Am -> F -> C -> G
    const bassline = [
      220, 220, 220, 220, // A
      174.61, 174.61, 174.61, 174.61, // F
      261.63, 261.63, 261.63, 261.63, // C
      196, 196, 196, 196 // G
    ];

    const melody = [
      440, 494, 523, 0, 523, 494, 440, 0, // Am melody
      349, 392, 440, 0, 440, 392, 349, 0, // F melody
      523, 587, 659, 0, 659, 587, 523, 0, // C melody
      392, 440, 494, 587, 494, 440, 392, 0  // G melody
    ];

    const playStep = () => {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      
      // 1. Play Bass Note (Every 2 steps, i.e., quarter notes)
      if (this.currentStep % 2 === 0) {
        const bassIdx = Math.floor(this.currentStep / 2) % bassline.length;
        const bassFreq = bassline[bassIdx] / 2; // Drop 1 octave
        
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        
        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);
        
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassFreq, now);
        
        bassGain.gain.setValueAtTime(0.08, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + this.stepTime * 1.8);
        
        bassOsc.start(now);
        bassOsc.stop(now + this.stepTime * 1.8);
      }

      // 2. Play Lead Melody
      const melodyIdx = this.currentStep % melody.length;
      const leadFreq = melody[melodyIdx];
      
      if (leadFreq > 0) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        
        leadOsc.connect(leadGain);
        leadGain.connect(this.musicGain);
        
        leadOsc.type = 'triangle';
        leadOsc.frequency.setValueAtTime(leadFreq, now);
        
        leadGain.gain.setValueAtTime(0.05, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + this.stepTime * 0.9);
        
        leadOsc.start(now);
        leadOsc.stop(now + this.stepTime * 0.9);
      }

      // 3. Simple hi-hat noise simulation (on beats)
      if (this.currentStep % 4 === 2) {
        const bufferSize = this.ctx.sampleRate * 0.04; // Very short click
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(8000, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.01, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.musicGain);
        
        noise.start(now);
      }

      this.currentStep = (this.currentStep + 1) % 32;
    };

    // Schedule tick using setInterval (perfectly fine for chiptune style BGM)
    this.bgmIntervalId = setInterval(playStep, this.stepTime * 1000);
  }

  stopBgm() {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
    this.isPlayingBgm = false;
  }
}

export const audio = new AudioEngine();
export default audio;
