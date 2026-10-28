/**
 * App.js - Unified Focus & Habit Deck Coordinator
 * Wires together Modules 1-5, UI event listeners, keyboard shortcuts, and soundboard controls.
 */

import { stateManager, getTodayDateString } from './state.js';
import { pomodoroTimer, TIMER_MODES } from './timer.js';
import { HeatmapRenderer } from './heatmap.js';
import { TaskAndHabitManager } from './tasks.js';
import { soundboard } from './audio.js';

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
