import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from scripts import fetch_data


class FetchDataWeekdayTests(unittest.TestCase):
    def test_parse_excluded_weekdays_defaults_to_friday_saturday(self) -> None:
        self.assertEqual(fetch_data.parse_excluded_weekdays("fri,sat"), {4, 5})

    def test_parse_excluded_weekdays_accepts_full_names(self) -> None:
        self.assertEqual(fetch_data.parse_excluded_weekdays("Friday,Saturday"), {4, 5})

    def test_parse_excluded_weekdays_accepts_iso_numbers(self) -> None:
        self.assertEqual(fetch_data.parse_excluded_weekdays("5,6"), {4, 5})

    def test_parse_excluded_weekdays_normalizes_case_and_whitespace(self) -> None:
        self.assertEqual(fetch_data.parse_excluded_weekdays(" FRI , Saturday "), {4, 5})

    def test_parse_excluded_weekdays_rejects_invalid_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "invalid excluded_weekdays"):
            fetch_data.parse_excluded_weekdays("fri,holiday")

    def test_parse_excluded_weekdays_rejects_empty_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "at least one weekday"):
            fetch_data.parse_excluded_weekdays(" , ")

    def test_run_skips_configured_non_working_days_without_fetch_or_store(self) -> None:
        db = MagicMock()
        market_endpoint = SimpleNamespace(credentials=SimpleNamespace(name="market_credential"))

        with (
            patch.object(fetch_data.settings, "excluded_weekdays", "fri,sat"),
            patch.object(fetch_data, "SessionLocal", return_value=db),
            patch.object(fetch_data.oms_endpoint_service, "get_active_endpoints", return_value={"market": market_endpoint}),
            patch.object(fetch_data, "get_tokens_for_active_endpoints", return_value={"market": "token"}),
            patch.object(fetch_data.fetch_service, "fetch_brokers", return_value=[{"broker": "ok"}]) as fetch_brokers,
            patch.object(fetch_data, "fetch_market_with_retry", return_value={"market": "ok"}) as fetch_market,
            patch.object(fetch_data.store_service, "store_broker_results") as store_brokers,
            patch.object(
                fetch_data.store_service,
                "store_market_result",
                return_value={"fetched": 1, "inserted": 1, "duplicates": 0},
            ) as store_market,
            self.assertLogs("fetch_data", level="INFO") as logs,
        ):
            fetch_data.run(date(2026, 7, 9), date(2026, 7, 12), "DSE")

        self.assertEqual(
            [call.args[3:5] for call in fetch_brokers.call_args_list],
            [("2026-07-09", "2026-07-09"), ("2026-07-12", "2026-07-12")],
        )
        self.assertEqual([call.args[4] for call in fetch_market.call_args_list], [date(2026, 7, 9), date(2026, 7, 12)])
        self.assertEqual(
            [call.args[2:4] for call in store_brokers.call_args_list],
            [("2026-07-09", "2026-07-09"), ("2026-07-12", "2026-07-12")],
        )
        self.assertEqual([call.args[3] for call in store_market.call_args_list], [date(2026, 7, 9), date(2026, 7, 12)])
        self.assertIn("Skipping non-working day: 2026-07-10 (Friday)", "\n".join(logs.output))
        self.assertIn("Skipping non-working day: 2026-07-11 (Saturday)", "\n".join(logs.output))
        db.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
