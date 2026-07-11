import unittest
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from app.scheduler import jobs


class SchedulerBusinessDayTests(unittest.TestCase):
    def test_default_scheduled_days_exclude_friday_and_saturday(self) -> None:
        self.assertEqual(jobs.normalize_scheduled_days("sun,mon,tue,wed,thu"), "sun,mon,tue,wed,thu")

    def test_scheduled_days_normalize_whitespace_and_case(self) -> None:
        self.assertEqual(jobs.normalize_scheduled_days(" SUN, Mon ,tue "), "sun,mon,tue")

    def test_scheduled_days_reject_empty_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "at least one weekday"):
            jobs.normalize_scheduled_days(" , ")

    def test_scheduled_days_reject_invalid_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "invalid scheduled_days"):
            jobs.normalize_scheduled_days("sun,holiday")

    def test_daily_trigger_skips_friday_and_saturday(self) -> None:
        timezone = ZoneInfo("Asia/Dhaka")

        with (
            patch.object(jobs.settings, "scheduled_time", "15:00"),
            patch.object(jobs.settings, "scheduled_days", "sun,mon,tue,wed,thu"),
            patch.object(jobs.settings, "app_timezone", "Asia/Dhaka"),
        ):
            trigger = jobs.build_daily_trigger()

        cases = [
            (datetime(2025, 1, 2, 14, 0, tzinfo=timezone), datetime(2025, 1, 2, 15, 0, tzinfo=timezone)),
            (datetime(2025, 1, 2, 16, 0, tzinfo=timezone), datetime(2025, 1, 5, 15, 0, tzinfo=timezone)),
            (datetime(2025, 1, 3, 12, 0, tzinfo=timezone), datetime(2025, 1, 5, 15, 0, tzinfo=timezone)),
            (datetime(2025, 1, 4, 12, 0, tzinfo=timezone), datetime(2025, 1, 5, 15, 0, tzinfo=timezone)),
            (datetime(2025, 1, 5, 14, 0, tzinfo=timezone), datetime(2025, 1, 5, 15, 0, tzinfo=timezone)),
        ]

        for now, expected in cases:
            with self.subTest(now=now):
                self.assertEqual(trigger.get_next_fire_time(None, now), expected)


if __name__ == "__main__":
    unittest.main()
