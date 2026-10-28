/**
 * Module 4: Daily "Big Three" & Habit Scoring Algorithm
 * Coordinates the Big Three task slots and daily habit pills.
 * Feeds activity points (+1 for tasks, +2 for workout, +1 for habits) directly into the Heatmap.
 */

import { stateManager, HABIT_CONFIG } from './state.js';
import { soundboard } from './audio.js';

export class TaskAndHabitManager {
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
