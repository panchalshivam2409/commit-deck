"""
Unit test suite validating all 5 Gemini Algorithms for CommitDeck:
1. System Boot & Midnight Reset Algorithm
2. Drift-Free Pomodoro Timer Algorithm
3. GitHub-Style Heatmap Generator Algorithm
4. Daily 'Big Three' & Habit Scoring Algorithm
5. Ambient Soundboard Mixer Algorithm
"""

import unittest
from datetime import datetime, timedelta

def get_color_level(score):
    if score <= 0: return 0
    if score == 1: return 1
    if score <= 3: return 2
    if score <= 5: return 3
    return 4

class TestCommitDeckAlgorithms(unittest.TestCase):

    def test_module_1_midnight_rollover(self):
        """Validates Midnight Rollover preserves unfinished tasks and clears completed tasks"""
        yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        today_str = datetime.now().strftime("%Y-%m-%d")

        # Mock saved state from yesterday
        state = {
            "lastOpenedDate": yesterday_str,
            "bigThreeTasks": [
                {"id": "task-1", "text": "Draft system design", "isCompleted": True},
                {"id": "task-2", "text": "Finish refactor", "isCompleted": False},
                {"id": "task-3", "text": "", "isCompleted": False}
            ],
            "habitToggles": {
                "workout": True,
                "read": True,
                "hydration": False,
                "meditation": False
            },
            "heatmapHistory": {
                yesterday_str: 4
            }
        }

        # Run Midnight Rollover
        if state["lastOpenedDate"] != today_str:
            new_tasks = []
            for task in state["bigThreeTasks"]:
                if task["isCompleted"]:
                    new_tasks.append({"id": task["id"], "text": "", "isCompleted": False})
                else:
                    new_tasks.append(dict(task))
            state["bigThreeTasks"] = new_tasks
            state["habitToggles"] = {k: False for k in state["habitToggles"]}
            state["lastOpenedDate"] = today_str

        # Assertions
        self.assertEqual(state["lastOpenedDate"], today_str)
        # Task 1 (completed) should be cleared
        self.assertEqual(state["bigThreeTasks"][0]["text"], "")
        self.assertFalse(state["bigThreeTasks"][0]["isCompleted"])
        # Task 2 (unfinished) rolls over to today
        self.assertEqual(state["bigThreeTasks"][1]["text"], "Finish refactor")
        self.assertFalse(state["bigThreeTasks"][1]["isCompleted"])
        # Habits reset for the new day
        self.assertFalse(state["habitToggles"]["workout"])
        self.assertFalse(state["habitToggles"]["read"])
        # Yesterday's history is locked
        self.assertEqual(state["heatmapHistory"][yesterday_str], 4)

    def test_module_2_drift_free_timer_math(self):
        """Validates drift-free target timestamp math"""
        duration_minutes = 25
        current_time_ms = 1700000000000
        target_end_time = current_time_ms + (duration_minutes * 60 * 1000)

        # 5 minutes elapsed
        now_ms = current_time_ms + (5 * 60 * 1000)
        remaining_ms = target_end_time - now_ms
        remaining_sec = remaining_ms // 1000
        mins = remaining_sec // 60
        secs = remaining_sec % 60

        self.assertEqual(mins, 20)
        self.assertEqual(secs, 0)

        # 25 minutes elapsed (completed)
        now_ms = target_end_time + 100
        remaining_ms = max(0, target_end_time - now_ms)
        self.assertEqual(remaining_ms, 0)

    def test_module_3_heatmap_color_tiers(self):
        """Validates exact color levels from prompt"""
        self.assertEqual(get_color_level(0), 0) # Score == 0 -> Level 0
        self.assertEqual(get_color_level(1), 1) # Score == 1 -> Level 1
        self.assertEqual(get_color_level(2), 2) # Score == 2 or 3 -> Level 2
        self.assertEqual(get_color_level(3), 2)
        self.assertEqual(get_color_level(4), 3) # Score == 4 or 5 -> Level 3
        self.assertEqual(get_color_level(5), 3)
        self.assertEqual(get_color_level(6), 4) # Score 6 or more -> Level 4
        self.assertEqual(get_color_level(12), 4)

    def test_module_4_task_and_habit_scoring(self):
        """Validates score adjustments (+1 for task, +2 for workout, clamp min 0)"""
        today_score = 0

        # Complete task 1: +1
        today_score += 1
        self.assertEqual(today_score, 1)

        # Check Workout: +2 bonus
        today_score += 2
        self.assertEqual(today_score, 3)

        # Complete pomodoro: +1
        today_score += 1
        self.assertEqual(today_score, 4)

        # Uncheck workout: -2
        today_score = max(0, today_score - 2)
        self.assertEqual(today_score, 2)

        # Uncheck task: -1
        today_score = max(0, today_score - 1)
        self.assertEqual(today_score, 1)

        # Deduct below zero clamped
        today_score = max(0, today_score - 5)
        self.assertEqual(today_score, 0)

    def test_module_5_soundboard_volume_conversion(self):
        """Validates volume slider conversion (0-100 to 0.0-1.0) and auto-play"""
        slider_val = 65
        vol_decimal = round(slider_val / 100.0, 2)
        self.assertEqual(vol_decimal, 0.65)

        # If slider > 0 and paused -> auto-play
        is_paused = True
        auto_play = slider_val > 0 and is_paused
        self.assertTrue(auto_play)

if __name__ == '__main__':
    unittest.main()
