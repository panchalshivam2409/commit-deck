/**
 * Module 5: Ambient Soundboard Mixer & Chime Synthesizer
 * Uses Web Audio API procedural synthesis for 100% offline, zero-dependency,
 * drift-free ambient focus sound generation and notification chimes.
 */

class SoundboardMixer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.tracks = new Map();
    this.isMuted = false;
    this.masterVolume = 0.8;

    // Track metadata
    this.trackDefs = [
      { id: 'rain', name: 'Gentle Rain', icon: '🌧️', defaultVol: 0.5 },
      { id: 'brown', name: 'Brown Noise', icon: '☕', defaultVol: 0.6 },
      { id: 'white', name: 'White Noise', icon: '💨', defaultVol: 0.4 },
      { id: 'waves', name: 'Ocean Waves', icon: '🌊', defaultVol: 0.5 },
      { id: 'fire', name: 'Campfire', icon: '🔥', defaultVol: 0.5 },
      { id: 'lofi', name: 'Lo-Fi Drone', icon: '🎧', defaultVol: 0.4 }
    ];
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Procedural Generators ---

  createNoiseBuffer(type = 'white', seconds = 5) {
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      if (type === 'white') {
        data[i] = white * 0.15;
      } else if (type === 'brown') {
        // Brown noise: integrated white noise
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 1.5;
      } else if (type === 'pink') {
        // Paul Kellet's pink noise algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  buildTrackGraph(trackId) {
    this.ensureContext();
    const trackGain = this.ctx.createGain();

    let sourceNode = null;
    let stopFn = null;

    if (trackId === 'white') {
      const buffer = this.createNoiseBuffer('white', 4);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4500, this.ctx.currentTime);

      src.connect(filter);
      filter.connect(trackGain);
      src.start();
      sourceNode = src;

    } else if (trackId === 'brown') {
      const buffer = this.createNoiseBuffer('brown', 4);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);

      src.connect(filter);
      filter.connect(trackGain);
      src.start();
      sourceNode = src;

    } else if (trackId === 'rain') {
      const pinkBuffer = this.createNoiseBuffer('pink', 5);
      const src = this.ctx.createBufferSource();
      src.buffer = pinkBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, this.ctx.currentTime);
      filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      // Droplet impulse simulation via LFO modulation
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      mod.frequency.setValueAtTime(0.3, this.ctx.currentTime);
      modGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      mod.connect(modGain.gain);

      src.connect(filter);
      filter.connect(trackGain);
      src.start();
      mod.start();
      sourceNode = src;
      stopFn = () => { try { mod.stop(); } catch(e){} };

    } else if (trackId === 'waves') {
      const pinkBuffer = this.createNoiseBuffer('pink', 6);
      const src = this.ctx.createBufferSource();
      src.buffer = pinkBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);

      // Slow rhythmic wave swell LFO
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8 sec per wave
      lfoGain.gain.setValueAtTime(300, this.ctx.currentTime);

      lfo.connect(filter.frequency);
      src.connect(filter);
      filter.connect(trackGain);

      src.start();
      lfo.start();
      sourceNode = src;
      stopFn = () => { try { lfo.stop(); } catch(e){} };

    } else if (trackId === 'fire') {
      const brownBuffer = this.createNoiseBuffer('brown', 4);
      const src = this.ctx.createBufferSource();
      src.buffer = brownBuffer;
      src.loop = true;

      const lowFilter = this.ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.setValueAtTime(300, this.ctx.currentTime);

      src.connect(lowFilter);
      lowFilter.connect(trackGain);
      src.start();

      // Campfire crackle timer
      let crackleInterval = setInterval(() => {
        if (!this.tracks.get(trackId)?.isPlaying) return;
        if (Math.random() < 0.4) {
          this.playCrackle(trackGain);
        }
      }, 180);

      sourceNode = src;
      stopFn = () => clearInterval(crackleInterval);

    } else if (trackId === 'lofi') {
      // Warm twin oscillators + gentle tape filter
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(110, this.ctx.currentTime); // A2
      osc2.frequency.setValueAtTime(164.81, this.ctx.currentTime); // E3

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(trackGain);

      osc1.start();
      osc2.start();
      sourceNode = osc1;
      stopFn = () => {
        try { osc2.stop(); } catch(e){}
      };
    }

    trackGain.connect(this.masterGain);

    return { sourceNode, trackGain, stopFn };
  }

  playCrackle(targetGain) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      const snapFilter = this.ctx.createBiquadFilter();

      snapOsc.type = 'sawtooth';
      snapOsc.frequency.setValueAtTime(800 + Math.random() * 1200, this.ctx.currentTime);

      snapFilter.type = 'highpass';
      snapFilter.frequency.setValueAtTime(1500, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      const duration = 0.02 + Math.random() * 0.04;
      snapGain.gain.setValueAtTime(0.08 + Math.random() * 0.12, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      snapOsc.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(targetGain);

      snapOsc.start(now);
      snapOsc.stop(now + duration);
    } catch(e) {}
  }

  // --- Public Mixer Controls ---

  initTrack(trackId, initialVolume = 0.5) {
    this.tracks.set(trackId, {
      id: trackId,
      isPlaying: false,
      volume: initialVolume,
      nodes: null
    });
  }

  playTrack(trackId) {
    this.ensureContext();
    let track = this.tracks.get(trackId);
    if (!track) {
      this.initTrack(trackId);
      track = this.tracks.get(trackId);
    }

    if (track.isPlaying) return;

    const nodes = this.buildTrackGraph(trackId);
    nodes.trackGain.gain.setValueAtTime(track.volume, this.ctx.currentTime);

    track.nodes = nodes;
    track.isPlaying = true;
  }

  pauseTrack(trackId) {
    const track = this.tracks.get(trackId);
    if (!track || !track.isPlaying) return;

    if (track.nodes) {
      try {
        if (track.nodes.sourceNode) track.nodes.sourceNode.stop();
        if (track.nodes.stopFn) track.nodes.stopFn();
      } catch (e) {}
      track.nodes = null;
    }
    track.isPlaying = false;
  }

  toggleTrack(trackId) {
    const track = this.tracks.get(trackId);
    if (track && track.isPlaying) {
      this.pauseTrack(trackId);
      return false;
    } else {
      this.playTrack(trackId);
      return true;
    }
  }

  setTrackVolume(trackId, volumeDecimal) {
    let track = this.tracks.get(trackId);
    if (!track) {
      this.initTrack(trackId, volumeDecimal);
      track = this.tracks.get(trackId);
    }

    const clamped = Math.max(0, Math.min(1, volumeDecimal));
    track.volume = clamped;

    if (track.nodes && track.nodes.trackGain) {
      track.nodes.trackGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }

    // Auto-play if volume > 0 and paused
    if (clamped > 0 && !track.isPlaying) {
      this.playTrack(trackId);
      return true;
    } else if (clamped === 0 && track.isPlaying) {
      this.pauseTrack(trackId);
      return false;
    }

    return track.isPlaying;
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  toggleMuteAll() {
    this.ensureContext();
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  stopAll() {
    for (const [id, track] of this.tracks.entries()) {
      if (track.isPlaying) {
        this.pauseTrack(id);
      }
    }
  }

  // --- Pomodoro Completion Notification Chime ---

  playChime() {
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Harmonic bell chord: F4, A4, C5, F5
    const frequencies = [349.23, 440.0, 523.25, 698.46];

    frequencies.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      const start = now + idx * 0.08;
      const duration = 2.2;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18 / (idx + 1), start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(start);
      osc.stop(start + duration);
    });
  }

  // Subtle click sound for UI feedback
  playClick() {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch(e) {}
  }
}

export const soundboard = new SoundboardMixer();
