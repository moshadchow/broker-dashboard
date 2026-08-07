from typing import Literal

EXCHANGE_CONFIG = {
    "DSE": {
        "market_symbol": "DSEX",
        "market_path": "DSE",
    },
    "CSE": {
        "market_symbol": "CSCX",
        "market_path": "CSE",
    },
}

SUPPORTED_EXCHANGES = ["DSE", "CSE"]

StockExchange = Literal["DSE", "CSE"]


def validate_exchange(exchange: str | None) -> StockExchange:
    if exchange is None:
        return "DSE"
    normalized = exchange.upper().strip()
    if normalized not in SUPPORTED_EXCHANGES:
        raise ValueError(f"Invalid stock exchange: {exchange}. Supported: {', '.join(SUPPORTED_EXCHANGES)}")
    return normalized  # type: ignore[return-value]


def get_market_symbol(exchange: StockExchange) -> str:
    return EXCHANGE_CONFIG[exchange]["market_symbol"]


def get_market_path(exchange: StockExchange) -> str:
    return EXCHANGE_CONFIG[exchange]["market_path"]
