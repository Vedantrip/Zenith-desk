// ZENITH SOUND ENGINE - OFFLINE WEB AUDIO SYNTHESIZER

class ZenithSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    
    // Active Nodes
    this.activeSource = null;
    this.activeOscL = null;
    this.activeOscR = null;
    this.activeModulator = null; // LFO for rain
    
    this.currentPreset = null; // 'rain', 'pink-noise', 'binaural'
    this.isPlaying = false;
  }

  // Lazy initialize Audio Context
  initContext() {
    if (!this.ctx) {
      // Support cross-browser audio context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime); // Default 50%
      this.masterGain.connect(this.ctx.destination);
    }
    
    // Resume context if suspended (browser security)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Set master volume (0.0 to 1.0)
  setVolume(value) {
    this.initContext();
    const vol = Math.max(0, Math.min(1, parseFloat(value)));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  // Stop all active synths
  stop() {
    if (!this.isPlaying) return;

    try {
      if (this.activeSource) {
        this.activeSource.stop();
        this.activeSource.disconnect();
        this.activeSource = null;
      }
      if (this.activeOscL) {
        this.activeOscL.stop();
        this.activeOscL.disconnect();
        this.activeOscL = null;
      }
      if (this.activeOscR) {
        this.activeOscR.stop();
        this.activeOscR.disconnect();
        this.activeOscR = null;
      }
      if (this.activeModulator) {
        this.activeModulator.stop();
        this.activeModulator.disconnect();
        this.activeModulator = null;
      }
    } catch (e) {
      console.warn('Error stopping sound nodes:', e);
    }

    this.isPlaying = false;
    this.currentPreset = null;
  }

  // Play preset soundscape
  play(preset) {
    this.initContext();
    this.stop(); // Stop anything running

    console.log(`Sound Engine: Playing preset [${preset}]`);

    switch (preset) {
      case 'pink-noise':
        this.playNoise('pink');
        break;
      case 'brown-noise':
        this.playNoise('brown');
        break;
      case 'binaural':
        this.playBinauralBeats(180, 190); // 10Hz Alpha beat (focused brain state)
        break;
      case 'rain':
        this.playSynthesizedRain();
        break;
      default:
        console.warn(`Unknown sound preset: ${preset}`);
        return;
    }

    this.isPlaying = true;
    this.currentPreset = preset;
  }

  // Generates sound buffers programmatically (White, Pink, Brown Noise)
  generateNoiseBuffer(type) {
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = 2 * sampleRate; // 2 seconds loop
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'pink') {
      // Pink Noise: 3dB/octave filter (Voss-McCartney algorithm approximation)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; // Normalize gain
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      // Brown Noise: 6dB/octave filter (Integration of white noise)
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Normalize gain
      }
    } else {
      // Fallback: White Noise (flat spectral density)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    return buffer;
  }

  // Play standard Pink or Brown noise loop
  playNoise(type) {
    const buffer = this.generateNoiseBuffer(type);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Gain node specific to noise to level it
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = type === 'brown' ? 0.8 : 0.6;

    source.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    source.start(0);

    this.activeSource = source;
  }

  // Play Synthesized Binaural Beats (Alpha focused)
  // Left ear = freq, Right ear = freq + differential (e.g. 200Hz and 210Hz)
  playBinauralBeats(baseFreq, targetFreq) {
    // Left Oscillator
    const oscL = this.ctx.createOscillator();
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    // Right Oscillator
    const oscR = this.ctx.createOscillator();
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(targetFreq, this.ctx.currentTime);

    // Left and Right Gain
    const gainL = this.ctx.createGain();
    const gainR = this.ctx.createGain();
    gainL.gain.value = 0.25; // Soft volume for sine waves
    gainR.gain.value = 0.25;

    // Stereo Panning
    const panL = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const panR = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    if (panL && panR) {
      panL.pan.setValueAtTime(-1.0, this.ctx.currentTime); // Pan left
      panR.pan.setValueAtTime(1.0, this.ctx.currentTime);  // Pan right

      oscL.connect(gainL);
      gainL.connect(panL);
      panL.connect(this.masterGain);

      oscR.connect(gainR);
      gainR.connect(panR);
      panR.connect(this.masterGain);
    } else {
      // Fallback if Panner not supported (mono mix)
      oscL.connect(gainL);
      gainL.connect(this.masterGain);
      oscR.connect(gainR);
      gainR.connect(this.masterGain);
    }

    oscL.start(0);
    oscR.start(0);

    this.activeOscL = oscL;
    this.activeOscR = oscR;
  }

  // Synthesizes natural Rain sounds programmatically
  playSynthesizedRain() {
    // Rain is simulated using a base of Brown Noise passed through a Bandpass filter,
    // combined with a Pink Noise generator passed through a modulated Lowpass filter (wind/surges).
    
    // 1. Base Rain (patter): Pink noise with Highpass filter
    const pinkBuffer = this.generateNoiseBuffer('pink');
    const patterSource = this.ctx.createBufferSource();
    patterSource.buffer = pinkBuffer;
    patterSource.loop = true;

    const patterFilter = this.ctx.createBiquadFilter();
    patterFilter.type = 'highpass';
    patterFilter.frequency.setValueAtTime(1200, this.ctx.currentTime); // High-pitched rain drops

    const patterGain = this.ctx.createGain();
    patterGain.gain.value = 0.2;

    patterSource.connect(patterFilter);
    patterFilter.connect(patterGain);
    patterGain.connect(this.masterGain);

    // 2. Heavy Rain / Wind rumbling: Brown noise with modulated Lowpass filter
    const brownBuffer = this.generateNoiseBuffer('brown');
    const rumbleSource = this.ctx.createBufferSource();
    rumbleSource.buffer = brownBuffer;
    rumbleSource.loop = true;

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(350, this.ctx.currentTime);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.value = 0.7;

    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    // 3. Modulator (LFO) to simulate gusts of wind/rain surges
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // Very slow swell (every ~12 seconds)

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 150; // Sweeps filter frequency by 150Hz

    // Connect LFO to Lowpass filter frequency to modulate it
    lfo.connect(lfoGain);
    lfoGain.connect(rumbleFilter.frequency);

    // Start all nodes
    patterSource.start(0);
    rumbleSource.start(0);
    lfo.start(0);

    // Keep track of primary nodes to terminate on stop()
    this.activeSource = patterSource;
    this.activeOscL = rumbleSource; // Reuse variable for second source
    this.activeModulator = lfo;
  }
}

// Export for browser import
window.ZenithSoundEngine = ZenithSoundEngine;
