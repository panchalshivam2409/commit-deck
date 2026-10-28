/**
 * Module 1: System Boot & Midnight Reset Algorithm
 * Handles application state, localStorage persistence, and daily rollover.
 */

const STORAGE_KEY = 'commit_deck_state_v1';

// Habit configuration with point weights
export const HABIT_CONFIG = {
  workout: { id: 'workout', name: 'Workout / Training', points: 2, icon: '⚡' },
  read: { id: 'read', name: 'Deep Reading (30m)', points: 1, icon: '📖' },
  hydration: { id: 'hydration', name: 'Hydration Target (2L+)', points: 1, icon: '💧' },
  meditation: { id: 'meditation', name: 'Mindfulness / Cold Shower', points: 1, icon: '🧘' }
};

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates default state object
 */
export function createDefaultState(today = getTodayDateString()) {
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

export const stateManager = new StateManager();
