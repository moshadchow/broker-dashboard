import unittest
from datetime import date

from app.routers.dashboard import _build_series


class DashboardTrendTests(unittest.TestCase):
    def test_value_percentages_use_market_value_directly_for_xfl(self) -> None:
        day = date(2025, 1, 1)

        series = _build_series(
            dates=[day],
            by_date_broker={
                day: {
                    "XFL": {"trade": 10.0, "value": 250.0},
                    "XXX": {"trade": 5.0, "value": 750.0},
                }
            },
            market_by_date={day: {"trade": 100.0, "value": 2_000.0}},
            metric="value",
            show_own_broker=False,
            own_external_api_id=None,
        )

        self.assertEqual(series.xfl, [1_000.0])
        self.assertEqual(series.market, [2_000.0])
        self.assertEqual(series.pctOfMarket, [50.0])

    def test_value_percentages_use_market_value_directly_for_own_broker(self) -> None:
        day = date(2025, 1, 1)

        series = _build_series(
            dates=[day],
            by_date_broker={
                day: {
                    "XFL": {"trade": 10.0, "value": 250.0},
                    "XXX": {"trade": 5.0, "value": 750.0},
                }
            },
            market_by_date={day: {"trade": 100.0, "value": 2_000.0}},
            metric="value",
            show_own_broker=True,
            own_external_api_id="XXX",
        )

        self.assertEqual(series.ownBroker, [750.0])
        self.assertEqual(series.xfl, [1_000.0])
        self.assertEqual(series.market, [2_000.0])
        self.assertEqual(series.pctOfMarket, [37.5])
        self.assertEqual(series.pctOfXfl, [75.0])


if __name__ == "__main__":
    unittest.main()
