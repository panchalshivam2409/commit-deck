/**
 * Module 2: Drift-Free Pomodoro Timer Algorithm
 * Uses timestamp math to prevent background tab interval drift.
 * Automatically logs completed focus sessions to the heatmap and switches to breaks.
 */

import { stateManager, getTodayDateString } from './state.js';
import { soundboard } from './audio.js';

export const TIMER_MODES = {
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

export const pomodoroTimer = new PomodoroTimer();
