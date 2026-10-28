/**
 * Module 3: GitHub-Style Heatmap Generator Algorithm
 * Generates a 52-week contribution grid using CSS Grid (repeat(7, 12px), auto-flow: column).
 * Computes streaks, activity levels, and renders custom hover tooltips.
 */

import { stateManager, getTodayDateString } from './state.js';

export function getColorLevel(score) {
  if (score <= 0) return 0;
  if (score === 1) return 1;
  if (score <= 3) return 2;
  if (score <= 5) return 3;
  return 4;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class HeatmapRenderer {
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
