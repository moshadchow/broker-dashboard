import unittest
from collections import namedtuple
from datetime import date

from app.routers.dashboard import _build_series, _latest_market_by_date


class DashboardTrendTests(unittest.TestCase):
    def test_latest_market_by_date_keeps_last_ordered_snapshot_per_day(self) -> None:
        MarketRow = namedtuple("MarketRow", ["snapshot_date", "trades", "values"])
        first_day = date(2025, 1, 1)
        second_day = date(2025, 1, 2)

        market_by_date = _latest_market_by_date(
            [
                MarketRow(first_day, 10, 100.0),
                MarketRow(first_day, 15, 150.0),
                MarketRow(second_day, 20, 200.0),
            ]
        )

        self.assertEqual(list(sorted(market_by_date)), [first_day, second_day])
        self.assertEqual(market_by_date[first_day], {"trade": 15.0, "value": 150.0})
        self.assertEqual(market_by_date[second_day], {"trade": 20.0, "value": 200.0})

    def test_empty_market_dates_return_empty_series(self) -> None:
        series = _build_series(
            dates=[],
            by_date_broker={},
            market_by_date={},
            metric="trade",
            show_own_broker=False,
            own_external_api_id=None,
        )

        self.assertEqual(series.xfl, [])
        self.assertEqual(series.market, [])
        self.assertEqual(series.pctOfMarket, [])
        self.assertIsNone(series.ownBroker)

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
