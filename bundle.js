(() => {
"use strict";

// >>> START: js/state.js >>>
/**
 * Module 1: System Boot & Midnight Reset Algorithm
 * Handles application state, localStorage persistence, and daily rollover.
 */

const STORAGE_KEY = 'commit_deck_state_v1';

// Habit configuration with point weights
const HABIT_CONFIG = {
  workout: { id: 'workout', name: 'Workout / Training', points: 2, icon: '⚡' },
  read: { id: 'read', name: 'Deep Reading (30m)', points: 1, icon: '📖' },
  hydration: { id: 'hydration', name: 'Hydration Target (2L+)', points: 1, icon: '💧' },
  meditation: { id: 'meditation', name: 'Mindfulness / Cold Shower', points: 1, icon: '🧘' }
};

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
function getTodayDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates default state object
 */
function createDefaultState(today = getTodayDateString()) {
  return {
    lastOpenedDate: today,
    bigThreeTasks: [
      { id: 'task-1', text: '', isCompleted: false },
      { id: 'task-2', text: '', isCompleted: false },
      { id: 'task-3', text: '', isCompleted: false }
    ],
    heatmapHistory: {}, // { "YYYY-MM-DD": score }
    habitToggles: {
      workout: false,
      read: false,
      hydration: false,
      meditation: false
    },
    pomodoroStats: {
      totalCompleted: 0,
      todayCompleted: 0
    },
    timerSettings: {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      autoStartBreaks: false
    }
  };
}

/**
 * State manager singleton
 */
class StateManager {
  constructor() {
    this.state = null;
    this.listeners = new Set();
  }

  /**
   * Initializes application state and runs the Midnight Rollover Algorithm
   */
  init() {
    const today = getTodayDateString();
    let loadedState = null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        loadedState = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to parse localStorage data:', e);
    }

    if (!loadedState) {
      // Step 3: No saved data exists
      this.state = createDefaultState(today);
      this.save();
    } else {
      // Merge with defaults to ensure all keys exist
      this.state = {
        ...createDefaultState(today),
        ...loadedState,
        bigThreeTasks: loadedState.bigThreeTasks || [
          { id: 'task-1', text: '', isCompleted: false },
          { id: 'task-2', text: '', isCompleted: false },
          { id: 'task-3', text: '', isCompleted: false }
        ],
        heatmapHistory: loadedState.heatmapHistory || {},
        habitToggles: loadedState.habitToggles || {},
        timerSettings: {
          ...createDefaultState(today).timerSettings,
          ...(loadedState.timerSettings || {})
        }
      };

      // Step 4: Midnight Rollover Check
      if (this.state.lastOpenedDate !== today) {
        this.runMidnightRollover(today);
      }
    }

    // Ensure today's entry exists in heatmapHistory
    if (typeof this.state.heatmapHistory[today] !== 'number') {
      this.state.heatmapHistory[today] = 0;
      this.save();
    }

    return this.state;
  }

  /**
   * Module 1 Step 4: Midnight Rollover logic
   * Unfinished tasks roll over to Today, completed tasks are archived/cleared.
   * Habits reset for the fresh day.
   */
  runMidnightRollover(today) {
    console.log(`[Midnight Rollover] Rollover triggered from ${this.state.lastOpenedDate} to ${today}`);

    // Completed tasks are cleared; unfinished tasks roll over
    this.state.bigThreeTasks = this.state.bigThreeTasks.map(task => {
      if (task.isCompleted) {
        return { id: task.id, text: '', isCompleted: false };
      }
      return { ...task }; // Keep unfinished work
    });

    // Reset daily habits for the new day
    this.state.habitToggles = {
      workout: false,
      read: false,
      hydration: false,
      meditation: false
    };

    if (this.state.pomodoroStats) {
      this.state.pomodoroStats.todayCompleted = 0;
    }

    this.state.lastOpenedDate = today;
    this.save();
  }

  /**
   * Saves current state to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notify();
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  /**
   * Subscribe to state updates
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // --- Score Mutators ---

  getTodayScore() {
    const today = getTodayDateString();
    return this.state.heatmapHistory[today] || 0;
  }

  adjustTodayScore(amount) {
    const today = getTodayDateString();
    const current = this.state.heatmapHistory[today] || 0;
    const nextScore = Math.max(0, current + amount);
    this.state.heatmapHistory[today] = nextScore;
    this.save();
    return nextScore;
  }

  // --- Task Mutators ---

  updateTaskText(index, text) {
    if (this.state.bigThreeTasks[index]) {
      this.state.bigThreeTasks[index].text = text;
      this.save();
    }
  }

  toggleTaskCompletion(index) {
    const task = this.state.bigThreeTasks[index];
    if (!task) return;

    task.isCompleted = !task.isCompleted;

    // +1 if checked, -1 if unchecked
    if (task.isCompleted) {
      this.adjustTodayScore(1);
    } else {
      this.adjustTodayScore(-1);
    }

    this.save();
  }

  clearTask(index) {
    const task = this.state.bigThreeTasks[index];
    if (!task) return;

    if (task.isCompleted) {
      this.adjustTodayScore(-1);
    }
    this.state.bigThreeTasks[index] = { id: `task-${index + 1}`, text: '', isCompleted: false };
    this.save();
  }

  // --- Habit Mutators ---

  toggleHabit(habitId) {
    const config = HABIT_CONFIG[habitId];
    if (!config) return;

    const currentStatus = !!this.state.habitToggles[habitId];
    const newStatus = !currentStatus;
    this.state.habitToggles[habitId] = newStatus;

    const points = config.points;
    if (newStatus) {
      this.adjustTodayScore(points);
    } else {
      this.adjustTodayScore(-points);
    }

    this.save();
  }

  // --- Pomodoro Mutator ---

  logCompletedPomodoro() {
    if (!this.state.pomodoroStats) {
      this.state.pomodoroStats = { totalCompleted: 0, todayCompleted: 0 };
    }
    this.state.pomodoroStats.totalCompleted += 1;
    this.state.pomodoroStats.todayCompleted += 1;

    // Bridge between Pomodoro and Heatmap: +1 score
    this.adjustTodayScore(1);
    this.save();
  }

  // --- Export / Import Backup ---

  exportData() {
    return JSON.stringify(this.state, null, 2);
  }

  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        this.state = parsed;
        this.save();
        return true;
      }
    } catch (e) {
      console.error('Import error:', e);
    }
    return false;
  }

  seedDemoData() {
    const today = new Date();
    const history = {};

    // Seed realistic past 365 days of productivity
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = getTodayDateString(d);

      // Higher activity on weekdays, random rest days
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const prob = isWeekend ? 0.45 : 0.85;

      if (Math.random() < prob) {
        // Random score from 1 to 7
        const weights = [1, 1, 2, 2, 3, 3, 4, 5, 6, 7];
        history[key] = weights[Math.floor(Math.random() * weights.length)];
      } else {
        history[key] = 0;
      }
    }

    // Keep today's current score
    const todayKey = getTodayDateString();
    history[todayKey] = this.state.heatmapHistory[todayKey] || 3;

    this.state.heatmapHistory = history;
    this.save();
  }
}
const stateManager = new StateManager();

// <<< END: js/state.js <<<

// >>> START: js/audio.js >>>
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
const soundboard = new SoundboardMixer();

// <<< END: js/audio.js <<<

// >>> START: js/timer.js >>>
/**
 * Module 2: Drift-Free Pomodoro Timer Algorithm
 * Uses timestamp math to prevent background tab interval drift.
 * Automatically logs completed focus sessions to the heatmap and switches to breaks.
 */
const TIMER_MODES = {
  FOCUS: 'focus',
  SHORT_BREAK: 'short_break',
  LONG_BREAK: 'long_break'
};

class PomodoroTimer {
  constructor() {
    this.mode = TIMER_MODES.FOCUS;
    this.timerState = 'STOPPED'; // 'STOPPED' | 'RUNNING' | 'PAUSED'
    this.durationMinutes = 25;
    this.targetEndTime = 0;
    this.remainingMs = 25 * 60 * 1000;
    this.totalDurationMs = 25 * 60 * 1000;
    this.intervalId = null;

    // Callbacks for UI updates
    this.onTick = null;
    this.onStateChange = null;
    this.onComplete = null;
  }

  init(options = {}) {
    this.onTick = options.onTick || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onComplete = options.onComplete || (() => {});

    // Set initial mode from state if available
    const settings = stateManager.state?.timerSettings;
    if (settings) {
      this.durationMinutes = settings.focusDuration || 25;
    }

    this.setMode(TIMER_MODES.FOCUS, false);
    this.bindKeyboardShortcuts();
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger if typing in an input or contenteditable element
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.toggle();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.reset();
      }
    });
  }

  setMode(mode, autoStart = false) {
    this.stop();
    this.mode = mode;

    const settings = stateManager.state?.timerSettings || {};
    let minutes = 25;

    if (mode === TIMER_MODES.FOCUS) {
      minutes = settings.focusDuration || 25;
    } else if (mode === TIMER_MODES.SHORT_BREAK) {
      minutes = settings.shortBreakDuration || 5;
    } else if (mode === TIMER_MODES.LONG_BREAK) {
      minutes = settings.longBreakDuration || 15;
    }

    this.durationMinutes = minutes;
    this.totalDurationMs = minutes * 60 * 1000;
    this.remainingMs = this.totalDurationMs;

    this.updateDisplay();
    this.onStateChange({
      state: this.timerState,
      mode: this.mode,
      remainingMs: this.remainingMs,
      totalDurationMs: this.totalDurationMs
    });

    if (autoStart) {
      this.start();
    }
  }

  start() {
    if (this.timerState === 'RUNNING') return;

    soundboard.ensureContext();
    const now = Date.now();

    if (this.timerState === 'PAUSED') {
      // Resume from paused remaining time
      this.targetEndTime = now + this.remainingMs;
    } else {
      // Fresh start
      this.targetEndTime = now + (this.remainingMs > 0 ? this.remainingMs : this.totalDurationMs);
    }

    this.timerState = 'RUNNING';

    // Drift-free loop: polling every 250ms
    clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.step(), 250);

    // Immediate first tick
    this.step();

    this.onStateChange({
      state: this.timerState,
      mode: this.mode,
      remainingMs: this.remainingMs,
      totalDurationMs: this.totalDurationMs
    });
  }

  pause() {
    if (this.timerState !== 'RUNNING') return;

    clearInterval(this.intervalId);
    this.intervalId = null;

    const now = Date.now();
    this.remainingMs = Math.max(0, this.targetEndTime - now);
    this.timerState = 'PAUSED';

    this.updateDisplay();
    this.onStateChange({
      state: this.timerState,
      mode: this.mode,
      remainingMs: this.remainingMs,
      totalDurationMs: this.totalDurationMs
    });
  }

  toggle() {
    if (this.timerState === 'RUNNING') {
      this.pause();
    } else {
      this.start();
    }
  }

  stop() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.timerState = 'STOPPED';
  }

  reset() {
    this.stop();
    this.remainingMs = this.totalDurationMs;
    this.updateDisplay();
    this.onStateChange({
      state: this.timerState,
      mode: this.mode,
      remainingMs: this.remainingMs,
      totalDurationMs: this.totalDurationMs
    });
  }

  /**
   * Drift-Free interval step calculation
   */
  step() {
    const now = Date.now();
    this.remainingMs = this.targetEndTime - now;

    if (this.remainingMs > 0) {
      this.updateDisplay();
    } else {
      this.remainingMs = 0;
      this.updateDisplay();
      this.handleComplete();
    }
  }

  handleComplete() {
    this.stop();

    // 1. Play chime
    soundboard.playChime();

    const completedMode = this.mode;

    // 2. If focus session completed, increment heatmap score
    if (completedMode === TIMER_MODES.FOCUS) {
      stateManager.logCompletedPomodoro();
    }

    // Trigger complete callback
    if (this.onComplete) {
      this.onComplete({
        mode: completedMode,
        todayScore: stateManager.getTodayScore()
      });
    }

    // 3. Switch mode automatically:
    // Focus -> Short Break (or Long Break if 4 focus completed)
    if (completedMode === TIMER_MODES.FOCUS) {
      const todayCount = stateManager.state?.pomodoroStats?.todayCompleted || 0;
      const nextMode = (todayCount % 4 === 0) ? TIMER_MODES.LONG_BREAK : TIMER_MODES.SHORT_BREAK;
      const autoStart = stateManager.state?.timerSettings?.autoStartBreaks || false;
      this.setMode(nextMode, autoStart);
    } else {
      // Break completed -> Switch back to Focus
      this.setMode(TIMER_MODES.FOCUS, false);
    }
  }

  updateDisplay() {
    const totalSeconds = Math.max(0, Math.ceil(this.remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Update browser tab title
    const modeLabel = this.mode === TIMER_MODES.FOCUS ? 'Focus' : 'Break';
    document.title = this.timerState === 'RUNNING'
      ? `(${formatted}) ${modeLabel} - CommitDeck`
      : 'CommitDeck - Unified Focus & Habit Deck';

    const progress = this.totalDurationMs > 0
      ? 1 - (this.remainingMs / this.totalDurationMs)
      : 0;

    if (this.onTick) {
      this.onTick({
        formatted,
        minutes,
        seconds,
        remainingMs: this.remainingMs,
        totalDurationMs: this.totalDurationMs,
        progress: Math.min(1, Math.max(0, progress)),
        state: this.timerState,
        mode: this.mode
      });
    }
  }
}
const pomodoroTimer = new PomodoroTimer();

// <<< END: js/timer.js <<<

// >>> START: js/heatmap.js >>>
/**
 * Module 3: GitHub-Style Heatmap Generator Algorithm
 * Generates a 52-week contribution grid using CSS Grid (repeat(7, 12px), auto-flow: column).
 * Computes streaks, activity levels, and renders custom hover tooltips.
 */
function getColorLevel(score) {
  if (score <= 0) return 0;
  if (score === 1) return 1;
  if (score <= 3) return 2;
  if (score <= 5) return 3;
  return 4;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
class HeatmapRenderer {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('heatmap-grid');
    this.monthLabelsContainer = options.monthLabelsContainer || document.getElementById('heatmap-months');
    this.tooltip = options.tooltip || document.getElementById('heatmap-tooltip');
    this.statsContainer = options.statsContainer || document.getElementById('heatmap-stats');
    this.selectedDateCallback = options.onSelectDate || null;

    this.todayKey = getTodayDateString();
  }

  /**
   * Main render function as defined in Module 3
   */
  render(history = stateManager.state.heatmapHistory) {
    if (!this.container) return;

    this.todayKey = getTodayDateString();
    this.container.innerHTML = '';
    if (this.monthLabelsContainer) {
      this.monthLabelsContainer.innerHTML = '';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // End date = Today
    const endDate = new Date(today);

    // Start date = 52 weeks ago aligned to Sunday so rows align:
    // Row 0 = Sunday, Row 1 = Monday ... Row 6 = Saturday
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);

    // Adjust start date backwards to the nearest Sunday for perfect GitHub column alignment
    const startDayOfWeek = startDate.getDay(); // 0 is Sunday
    if (startDayOfWeek !== 0) {
      startDate.setDate(startDate.getDate() - startDayOfWeek);
    }

    let cursor = new Date(startDate);
    let weekIndex = 0;
    let lastMonth = -1;
    const monthOffsets = []; // { month: 'Jan', weekIndex: 0 }

    // Loop through days from startDate to endDate
    while (cursor <= endDate) {
      const dateKey = getTodayDateString(cursor);
      const score = typeof history[dateKey] === 'number' ? history[dateKey] : 0;
      const level = getColorLevel(score);
      const dayOfWeek = cursor.getDay();

      // Track month transitions for header labels (on Sundays)
      if (dayOfWeek === 0) {
        const monthNum = cursor.getMonth();
        if (monthNum !== lastMonth) {
          monthOffsets.push({
            monthName: MONTH_NAMES[monthNum],
            weekIndex: weekIndex
          });
          lastMonth = monthNum;
        }
      }

      // Create square cell
      const square = document.createElement('div');
      square.className = `heat-cell level-${level}`;
      square.dataset.date = dateKey;
      square.dataset.score = score;

      if (dateKey === this.todayKey) {
        square.classList.add('is-today');
      }

      // Tooltip content
      const displayDate = cursor.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const ptLabel = score === 1 ? 'point' : 'points';
      const tooltipText = `${score} ${ptLabel} on ${displayDate}`;
      square.dataset.tooltip = tooltipText;

      // Event listeners for tooltip and click
      this.attachCellEvents(square, dateKey, score, displayDate);

      this.container.appendChild(square);

      // Increment cursor by 1 day
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === 0) {
        weekIndex++;
      }
    }

    // Render Month labels positioned over week columns
    if (this.monthLabelsContainer) {
      this.renderMonthLabels(monthOffsets);
    }

    // Update Streak and Stat counters
    this.updateStats(history, today);
  }

  renderMonthLabels(offsets) {
    this.monthLabelsContainer.innerHTML = '';
    // Total weeks is around 53 columns. Column width = 12px + 3px gap = 15px
    let lastRenderedCol = -4; // require at least 3 weeks (~45px) between month labels
    offsets.forEach(item => {
      if (item.weekIndex - lastRenderedCol >= 3) {
        const label = document.createElement('span');
        label.className = 'month-label';
        label.textContent = item.monthName;
        // Position label horizontally using column index
        label.style.left = `${item.weekIndex * 15}px`;
        this.monthLabelsContainer.appendChild(label);
        lastRenderedCol = item.weekIndex;
      }
    });
  }

  attachCellEvents(square, dateKey, score, displayDate) {
    square.addEventListener('mouseenter', (e) => {
      if (!this.tooltip) return;
      const ptLabel = score === 1 ? 'point' : 'points';
      this.tooltip.innerHTML = `<strong>${score} ${ptLabel}</strong> on ${displayDate}`;
      this.tooltip.classList.add('visible');

      const rect = square.getBoundingClientRect();
      const parentRect = this.container.closest('.heatmap-wrapper')?.getBoundingClientRect() || rect;
      
      const left = rect.left - parentRect.left + (rect.width / 2);
      const top = rect.top - parentRect.top - 8;

      this.tooltip.style.left = `${left}px`;
      this.tooltip.style.top = `${top}px`;
    });

    square.addEventListener('mouseleave', () => {
      if (this.tooltip) {
        this.tooltip.classList.remove('visible');
      }
    });

    square.addEventListener('click', () => {
      // Highlight selected
      this.container.querySelectorAll('.heat-cell.selected').forEach(c => c.classList.remove('selected'));
      square.classList.add('selected');

      if (this.selectedDateCallback) {
        this.selectedDateCallback(dateKey, score, displayDate);
      }
    });
  }

  /**
   * Module 4 Step 5: Update only Today's square in the Heatmap
   * for ultra-fast, smooth updates without re-building the whole grid.
   */
  updateTodaySquare(newScore) {
    const todayCell = this.container.querySelector(`.heat-cell[data-date="${this.todayKey}"]`);
    if (todayCell) {
      const level = getColorLevel(newScore);
      todayCell.className = `heat-cell level-${level} is-today`;
      todayCell.dataset.score = newScore;

      const today = new Date();
      const displayDate = today.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const ptLabel = newScore === 1 ? 'point' : 'points';
      todayCell.dataset.tooltip = `${newScore} ${ptLabel} on ${displayDate}`;
    }

    // Refresh streak and totals
    this.updateStats(stateManager.state.heatmapHistory, new Date());
  }

  updateStats(history, today) {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let totalPoints = 0;
    let activeDays = 0;

    const checkDate = new Date(today);
    checkDate.setHours(0, 0, 0, 0);

    // Calculate Current Streak backwards from today
    let streakCursor = new Date(checkDate);
    const todayScore = history[getTodayDateString(streakCursor)] || 0;
    
    // If today is 0, check if yesterday had a streak
    if (todayScore === 0) {
      streakCursor.setDate(streakCursor.getDate() - 1);
    }

    while (true) {
      const key = getTodayDateString(streakCursor);
      const score = history[key] || 0;
      if (score > 0) {
        currentStreak++;
        streakCursor.setDate(streakCursor.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate Longest Streak and Totals across the 365 days
    let scanDate = new Date(checkDate);
    scanDate.setDate(scanDate.getDate() - 364);

    while (scanDate <= checkDate) {
      const key = getTodayDateString(scanDate);
      const score = history[key] || 0;

      if (score > 0) {
        activeDays++;
        totalPoints += score;
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }

      scanDate.setDate(scanDate.getDate() + 1);
    }

    // Update DOM stat counters
    const currentStreakEl = document.getElementById('stat-current-streak');
    const longestStreakEl = document.getElementById('stat-longest-streak');
    const totalPointsEl = document.getElementById('stat-total-points');
    const activeDaysEl = document.getElementById('stat-active-days');
    const todayPointsEl = document.getElementById('stat-today-points');

    if (currentStreakEl) currentStreakEl.textContent = `${currentStreak} day${currentStreak === 1 ? '' : 's'}`;
    if (longestStreakEl) longestStreakEl.textContent = `${longestStreak} day${longestStreak === 1 ? '' : 's'}`;
    if (totalPointsEl) totalPointsEl.textContent = totalPoints.toLocaleString();
    if (activeDaysEl) activeDaysEl.textContent = activeDays.toLocaleString();
    if (todayPointsEl) todayPointsEl.textContent = stateManager.getTodayScore();
  }
}

// <<< END: js/heatmap.js <<<

// >>> START: js/tasks.js >>>
/**
 * Module 4: Daily "Big Three" & Habit Scoring Algorithm
 * Coordinates the Big Three task slots and daily habit pills.
 * Feeds activity points (+1 for tasks, +2 for workout, +1 for habits) directly into the Heatmap.
 */
class TaskAndHabitManager {
  constructor(options = {}) {
    this.tasksContainer = options.tasksContainer || document.getElementById('big-three-container');
    this.habitsContainer = options.habitsContainer || document.getElementById('habits-container');
    this.onScoreChanged = options.onScoreChanged || (() => {});
  }

  init() {
    this.renderBigThree();
    this.renderHabits();
  }

  // --- Big Three Tasks ---

  renderBigThree() {
    if (!this.tasksContainer) return;

    this.tasksContainer.innerHTML = '';
    const tasks = stateManager.state.bigThreeTasks;

    tasks.forEach((task, index) => {
      const slotEl = document.createElement('div');
      slotEl.className = `task-slot ${task.isCompleted ? 'completed' : ''}`;
      slotEl.dataset.index = index;

      slotEl.innerHTML = `
        <div class="task-number">0${index + 1}</div>
        <label class="task-checkbox-label">
          <input type="checkbox" class="task-checkbox" ${task.isCompleted ? 'checked' : ''} />
          <span class="custom-checkbox"></span>
        </label>
        <input 
          type="text" 
          class="task-input" 
          placeholder="Daily priority #${index + 1}..."
          value="${escapeHtml(task.text)}"
        />
        <div class="task-points-badge" title="Worth +1 point on the contribution heatmap">+1 pt</div>
        <button type="button" class="task-clear-btn" title="Clear slot">×</button>
      `;

      // Event: Checkbox Toggle (checked vs unchecked)
      const checkbox = slotEl.querySelector('.task-checkbox');
      checkbox.addEventListener('change', () => {
        soundboard.playClick();
        stateManager.toggleTaskCompletion(index);
        slotEl.classList.toggle('completed', stateManager.state.bigThreeTasks[index].isCompleted);
        this.onScoreChanged(stateManager.getTodayScore());
      });

      // Event: Text input change
      const textInput = slotEl.querySelector('.task-input');
      const saveText = () => {
        stateManager.updateTaskText(index, textInput.value.trim());
      };
      textInput.addEventListener('blur', saveText);
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveText();
          textInput.blur();
        }
      });

      // Event: Clear button
      const clearBtn = slotEl.querySelector('.task-clear-btn');
      clearBtn.addEventListener('click', () => {
        soundboard.playClick();
        stateManager.clearTask(index);
        this.renderBigThree();
        this.onScoreChanged(stateManager.getTodayScore());
      });

      this.tasksContainer.appendChild(slotEl);
    });
  }

  // --- Daily Habits ---

  renderHabits() {
    if (!this.habitsContainer) return;

    this.habitsContainer.innerHTML = '';
    const toggles = stateManager.state.habitToggles || {};

    Object.values(HABIT_CONFIG).forEach(habit => {
      const isChecked = !!toggles[habit.id];
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `habit-pill ${isChecked ? 'active' : ''}`;
      pill.dataset.habitId = habit.id;

      pill.innerHTML = `
        <span class="habit-icon">${habit.icon}</span>
        <span class="habit-name">${habit.name}</span>
        <span class="habit-badge">+${habit.points} pts</span>
        <span class="habit-status-icon">${isChecked ? '✓' : '+'}</span>
      `;

      pill.addEventListener('click', () => {
        soundboard.playClick();
        stateManager.toggleHabit(habit.id);
        const nextStatus = !!stateManager.state.habitToggles[habit.id];
        pill.classList.toggle('active', nextStatus);
        pill.querySelector('.habit-status-icon').textContent = nextStatus ? '✓' : '+';
        this.onScoreChanged(stateManager.getTodayScore());
      });

      this.habitsContainer.appendChild(pill);
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// <<< END: js/tasks.js <<<

// >>> START: js/app.js >>>
/**
 * App.js - Unified Focus & Habit Deck Coordinator
 * Wires together Modules 1-5, UI event listeners, keyboard shortcuts, and soundboard controls.
 */





class CommitDeckApp {
  constructor() {
    this.heatmap = null;
    this.tasksManager = null;
  }

  init() {
    console.log('[CommitDeck] Initializing system boot...');

    // 1. Module 1: Boot state & run midnight reset algorithm
    stateManager.init();

    // Instant demo preview if ?seed=true is present
    if (window.location.search.includes('seed=true')) {
      stateManager.seedDemoData();
      stateManager.state.bigThreeTasks[0] = { id: 'task-1', text: 'Build CommitDeck production release', isCompleted: true };
      stateManager.state.bigThreeTasks[1] = { id: 'task-2', text: '52-Week GitHub heatmap contribution grid', isCompleted: true };
      stateManager.state.bigThreeTasks[2] = { id: 'task-3', text: 'Web Audio ambient focus sound mixer', isCompleted: false };
      stateManager.state.habitToggles.workout = true;
      stateManager.state.habitToggles.read = true;
      stateManager.save();
    }

    // 2. Display formatted current date in header
    this.renderHeaderDate();

    // 3. Module 3: Initialize Heatmap
    this.heatmap = new HeatmapRenderer({
      container: document.getElementById('heatmap-grid'),
      monthLabelsContainer: document.getElementById('heatmap-months'),
      tooltip: document.getElementById('heatmap-tooltip'),
      onSelectDate: (dateKey, score, displayDate) => {
        this.showDayDetail(dateKey, score, displayDate);
      }
    });
    this.heatmap.render();

    // 4. Module 4: Initialize Big Three Tasks & Habits
    this.tasksManager = new TaskAndHabitManager({
      tasksContainer: document.getElementById('big-three-container'),
      habitsContainer: document.getElementById('habits-container'),
      onScoreChanged: (newScore) => {
        this.heatmap.updateTodaySquare(newScore);
        this.updateHeaderScore(newScore);
      }
    });
    this.tasksManager.init();

    // 5. Module 2: Initialize Drift-Free Pomodoro Timer
    this.initTimerUI();

    // 6. Module 5: Initialize Soundboard Mixer UI
    this.initSoundboardUI();

    // 7. Modals and Settings
    this.initSettingsModal();

    // Update initial header score
    this.updateHeaderScore(stateManager.getTodayScore());
  }

  renderHeaderDate() {
    const todayEl = document.getElementById('current-date-badge');
    if (!todayEl) return;
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    todayEl.textContent = formatted;
  }

  updateHeaderScore(score) {
    const scoreBadge = document.getElementById('header-today-score');
    if (scoreBadge) {
      scoreBadge.textContent = `${score} pts today`;
    }
  }

  // --- Timer UI Integration ---

  initTimerUI() {
    const timeDisplay = document.getElementById('timer-time');
    const toggleBtn = document.getElementById('timer-toggle-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const modeButtons = document.querySelectorAll('.timer-mode-btn');
    const progressRing = document.getElementById('timer-progress-ring');
    const timerCard = document.querySelector('.timer-card');

    const circumference = 2 * Math.PI * 135; // radius = 135

    if (progressRing) {
      progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
      progressRing.style.strokeDashoffset = '0';
    }

    pomodoroTimer.init({
      onTick: (data) => {
        if (timeDisplay) timeDisplay.textContent = data.formatted;
        if (progressRing) {
          const offset = circumference * (1 - data.progress);
          progressRing.style.strokeDashoffset = offset;
        }
      },
      onStateChange: (data) => {
        if (toggleBtn) {
          if (data.state === 'RUNNING') {
            toggleBtn.innerHTML = '<span class="icon">⏸</span><span>Pause</span>';
            toggleBtn.classList.add('btn-active');
            timerCard?.classList.add('timer-running');
          } else {
            toggleBtn.innerHTML = '<span class="icon">▶</span><span>Start</span>';
            toggleBtn.classList.remove('btn-active');
            timerCard?.classList.remove('timer-running');
          }
        }

        // Update active mode button
        modeButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === data.mode);
        });
      },
      onComplete: (data) => {
        this.heatmap.updateTodaySquare(data.todayScore);
        this.updateHeaderScore(data.todayScore);
        this.triggerCelebration();
      }
    });

    // Button controls
    toggleBtn?.addEventListener('click', () => {
      pomodoroTimer.toggle();
    });

    resetBtn?.addEventListener('click', () => {
      soundboard.playClick();
      pomodoroTimer.reset();
    });

    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        soundboard.playClick();
        const mode = btn.dataset.mode;
        pomodoroTimer.setMode(mode, false);
      });
    });
  }

  // --- Soundboard Mixer UI ---

  initSoundboardUI() {
    const container = document.getElementById('soundboard-grid');
    const masterMuteBtn = document.getElementById('master-mute-btn');
    const masterVolSlider = document.getElementById('master-volume-slider');

    if (!container) return;
    container.innerHTML = '';

    soundboard.trackDefs.forEach(track => {
      const card = document.createElement('div');
      card.className = 'sound-card';
      card.dataset.trackId = track.id;

      card.innerHTML = `
        <div class="sound-card-header">
          <span class="sound-icon">${track.icon}</span>
          <span class="sound-title">${track.name}</span>
          <button type="button" class="sound-toggle-btn" title="Toggle audio">
            <span class="play-state-icon">▶</span>
          </button>
        </div>
        <div class="sound-volume-row">
          <span class="vol-icon">🔈</span>
          <input 
            type="range" 
            class="sound-vol-slider" 
            min="0" 
            max="100" 
            value="${track.defaultVol * 100}" 
          />
          <span class="vol-label">${Math.round(track.defaultVol * 100)}%</span>
        </div>
      `;

      const toggleBtn = card.querySelector('.sound-toggle-btn');
      const stateIcon = card.querySelector('.play-state-icon');
      const slider = card.querySelector('.sound-vol-slider');
      const volLabel = card.querySelector('.vol-label');

      // Initialize track in soundboard
      soundboard.initTrack(track.id, track.defaultVol);

      // Toggle Play / Pause
      toggleBtn.addEventListener('click', () => {
        const isPlaying = soundboard.toggleTrack(track.id);
        card.classList.toggle('playing', isPlaying);
        stateIcon.textContent = isPlaying ? '■' : '▶';
      });

      // Volume slider change: converts 0-100 to 0.0-1.0 and auto-plays if volume > 0
      slider.addEventListener('input', () => {
        const decimal = parseInt(slider.value, 10) / 100;
        volLabel.textContent = `${slider.value}%`;
        const isPlaying = soundboard.setTrackVolume(track.id, decimal);
        card.classList.toggle('playing', isPlaying);
        stateIcon.textContent = isPlaying ? '■' : '▶';
      });

      container.appendChild(card);
    });

    // Master Mute
    masterMuteBtn?.addEventListener('click', () => {
      const muted = soundboard.toggleMuteAll();
      masterMuteBtn.classList.toggle('is-muted', muted);
      masterMuteBtn.innerHTML = muted ? '🔇 <span>Unmute</span>' : '🔊 <span>Mute All</span>';
    });

    // Master Volume
    masterVolSlider?.addEventListener('input', () => {
      const vol = parseInt(masterVolSlider.value, 10) / 100;
      soundboard.setMasterVolume(vol);
    });
  }

  // --- Celebration Animation on Pomodoro Complete ---

  triggerCelebration() {
    const banner = document.getElementById('celebration-banner');
    if (banner) {
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 4000);
    }
  }

  // --- Day Detail Inspector ---

  showDayDetail(dateKey, score, displayDate) {
    const inspector = document.getElementById('day-inspector');
    if (!inspector) return;

    inspector.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-header">
          <strong>${displayDate}</strong>
          <span class="inspector-badge level-${this.heatmap ? Math.min(4, score) : 0}">${score} Points</span>
        </div>
        <p class="inspector-desc">
          ${score === 0 ? 'No activities recorded on this day.' : 'Contributions logged for focus sessions, big three priorities, and habits.'}
        </p>
      </div>
    `;
    inspector.classList.remove('hidden');
  }

  // --- Settings Modal & Utilities ---

  initSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('modal-close-btn');

    const focusInput = document.getElementById('setting-focus-duration');
    const shortBreakInput = document.getElementById('setting-short-break');
    const longBreakInput = document.getElementById('setting-long-break');
    const autoBreakCheck = document.getElementById('setting-auto-breaks');

    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const seedDemoBtn = document.getElementById('seed-demo-btn');
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importInput = document.getElementById('import-file-input');
    const resetAllBtn = document.getElementById('reset-all-btn');

    settingsBtn?.addEventListener('click', () => {
      soundboard.playClick();
      // Populate inputs with current settings
      const settings = stateManager.state.timerSettings || {};
      if (focusInput) focusInput.value = settings.focusDuration || 25;
      if (shortBreakInput) shortBreakInput.value = settings.shortBreakDuration || 5;
      if (longBreakInput) longBreakInput.value = settings.longBreakDuration || 15;
      if (autoBreakCheck) autoBreakCheck.checked = !!settings.autoStartBreaks;

      modal?.classList.add('open');
    });

    closeBtn?.addEventListener('click', () => {
      modal?.classList.remove('open');
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    saveSettingsBtn?.addEventListener('click', () => {
      soundboard.playClick();
      stateManager.state.timerSettings = {
        focusDuration: parseInt(focusInput.value, 10) || 25,
        shortBreakDuration: parseInt(shortBreakInput.value, 10) || 5,
        longBreakDuration: parseInt(longBreakInput.value, 10) || 15,
        autoStartBreaks: autoBreakCheck.checked
      };
      stateManager.save();
      pomodoroTimer.setMode(pomodoroTimer.mode, false);
      modal?.classList.remove('open');
    });

    // Seed Demo Data
    seedDemoBtn?.addEventListener('click', () => {
      if (confirm('Load realistic 365-day sample contribution data for preview?')) {
        stateManager.seedDemoData();
        this.heatmap.render();
        this.updateHeaderScore(stateManager.getTodayScore());
        modal?.classList.remove('open');
      }
    });

    // Export Data JSON
    exportBtn?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(stateManager.exportData());
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `commit_deck_backup_${getTodayDateString()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Import Data JSON
    importBtn?.addEventListener('click', () => {
      importInput?.click();
    });

    importInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const ok = stateManager.importData(event.target.result);
        if (ok) {
          alert('Data imported successfully!');
          location.reload();
        } else {
          alert('Failed to parse backup JSON file.');
        }
      };
      reader.readAsText(file);
    });

    // Reset All Data
    resetAllBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all tasks, streaks, and heatmap history? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
      }
    });
  }
}

// Boot application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CommitDeckApp();
  app.init();
});

// <<< END: js/app.js <<<

})();