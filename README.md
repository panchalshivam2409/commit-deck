# CommitDeck 🟩
### Unified Focus & Habit Deck

A high-performance, state-driven developer dashboard pairing a **Drift-Free Pomodoro Focus Deck** with an interactive **GitHub-Style 365-Day Contribution Heatmap** and an ambient **Web Audio Soundboard Mixer**.

---

## 🚀 Quick Start

1. **Direct Launch**:
   - Double-click `start.bat` or open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Brave, Safari).
   - Zero installation, zero external CDN dependencies, 100% offline-ready.

2. **Preview Mode**:
   - Open `index.html?seed=true` or click **Settings ⚙️ &rarr; Seed Sample 365-Day Data** to preview the full 52-week heatmap populated with realistic activity levels, streaks, and stats.

---

## 🧠 Architecture & Logical Modules

The application translates Gemini's 5 core algorithms directly into clean JavaScript modules:

### 1. System Boot & Midnight Reset (`js/state.js`)
- Runs upon application launch.
- Checks if a new day has arrived (`State.lastOpenedDate !== Today`).
- **Rollover Rule**: Completed Big Three tasks are archived/cleared; unfinished tasks persist and roll over to Today so no work is lost.
- Resets daily habit toggles for a clean slate.
- Persists state reliably in browser `localStorage`.
- Includes full JSON Backup Export & Restore.

### 2. Drift-Free Pomodoro Timer (`js/timer.js`)
- Solves background tab throttling (`setInterval` lag) using target timestamp math:  
  `Target_End_Time = Current_Time + (Duration_Minutes * 60 * 1000)`
- Polls `Target_End_Time - Date.now()` every 250ms for 100% accuracy even when switching tabs or working in your IDE.
- Formats remaining time in `MM:SS` and dynamically updates the browser tab title.
- Spacebar shortcut to Start/Pause, `R` to Reset.
- Multi-tone harmonic chime synthesized via Web Audio API.
- Automatically increments `heatmapHistory[Today]` by +1 on completion, turns today's square greener, and switches to a 5-minute break.

### 3. GitHub-Style Heatmap Generator (`js/heatmap.js`)
- 52-week dynamic grid covering 365 days (Sunday to Saturday rows).
- Styled with CSS Grid:  
  `display: grid; grid-template-rows: repeat(7, 12px); grid-auto-flow: column; gap: 3px;`
- Accurately aligns day-of-week rows and displays Month headers along the top.
- 5 color levels based on score:
  - **Level 0**: 0 pts (Dark Slate Grey `#161b22`)
  - **Level 1**: 1 pt (Dim Emerald `#0e4429`)
  - **Level 2**: 2–3 pts (Medium Green `#006d32`)
  - **Level 3**: 4–5 pts (Vibrant Green `#26a641`)
  - **Level 4**: 6+ pts (Neon Mint `#39d353` - peak day)
- Interactive hover tooltips showing `{Score} points on {Date_Key}`.
- Click any cell to inspect activity.
- Computes Current Streak, Longest Streak, Active Days, and Annual Total.

### 4. Daily "Big Three" & Habit Scoring (`js/tasks.js`)
- Enforces focus on top 3 priorities for the day.
- Checking/unchecking dynamically updates today's score (+1 / -1) and updates today's square.
- Built-in habit engine with weighted bonuses:
  - **Workout / Training**: `+2 points`
  - **Deep Reading**: `+1 point`
  - **Hydration Target**: `+1 point`
  - **Mindfulness**: `+1 point`

### 5. Ambient Soundboard Mixer (`js/audio.js`)
- Procedurally generated sound engines using the browser's native **Web Audio API**:
  - 🌧️ **Gentle Rain**: Bandpass filtered pink noise with droplet impulses.
  - ☕ **Brown Noise**: Integrated Brownian noise for deep focus rumble.
  - 💨 **White Noise**: Crisp frequency mask.
  - 🌊 **Ocean Waves**: Sinusoidal LFO sweep modulating pink noise.
  - 🔥 **Campfire**: Low rumble with random stochastic crackles.
  - 🎧 **Lo-Fi Drone**: Analog dual-oscillator warmth.
- Independent volume sliders (0–100% &rarr; 0.0–1.0 gain).
- Active glowing borders on running tracks.
- Auto-starts audio if volume slider is moved above 0 while paused.
- Master Mute & Volume control.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Start / Pause Pomodoro Timer |
| <kbd>R</kbd> | Reset Pomodoro Timer |

---

## 📁 File Structure

```
commit-deck/
├── index.html              # Main dashboard UI layout
├── start.bat               # Windows one-click launcher
├── README.md               # Documentation & user guide
├── css/
│   └── styles.css          # Dark cyberpunk/GitHub theme styles
├── js/
│   ├── state.js            # Module 1: State engine & midnight rollover
│   ├── timer.js            # Module 2: Drift-free Pomodoro timer
│   ├── heatmap.js          # Module 3: 52-week GitHub heatmap generator
│   ├── tasks.js            # Module 4: Big Three tasks & habit scoring
│   ├── audio.js            # Module 5: Web Audio API soundboard mixer
│   ├── app.js              # Coordinator & event wiring
│   └── bundle.js           # Consolidated bundle for direct file:/// execution
├── build_bundle.py         # Zero-dependency bundler
└── test_algorithm.py       # Comprehensive unit tests for all 5 algorithms
```

---

## 🧪 Verification

Run the test suite anytime:
```powershell
python test_algorithm.py
```
All 5 modules tested and passed with 100% accuracy.
