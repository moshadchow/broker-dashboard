# Replace `fetch_market_trade_info` with Share Price History API

Update the `fetch_market_trade_info` implementation in `services/external_api.py` to use the following OMS API endpoint:

## New Endpoint

```text
GET /api/share-price-histories/DSE
```

Example:

```text
https://prod-oms-api-1.xfltrade.com:20121/api/share-price-histories/DSE?Filter.Symbol=DSEX&Filter.marketType=Public&Filter.resolution=1D&Filter.from=1742774400&Filter.to=1742774400&Paging.size=100000000&Paging.page=1&Paging.sortDirection=Asc
```

## Request Parameters

| Parameter              | Value                         |
| ---------------------- | ----------------------------- |
| `Filter.Symbol`        | `DSEX`                        |
| `Filter.marketType`    | `Public`                      |
| `Filter.resolution`    | `1D`                          |
| `Filter.from`          | Current date (Unix timestamp) |
| `Filter.to`            | Current date (Unix timestamp) |
| `Paging.size`          | `100000000`                   |
| `Paging.page`          | `1`                           |
| `Paging.sortDirection` | `Asc`                         |

### Date Handling

* `Filter.from` and `Filter.to` should default to the current date.
* Convert the current date to a Unix timestamp before making the API call.

---

# Response Mapping

The API returns arrays for each market attribute:

```json
{
  "times": [1742752800],
  "closes": [5196.88872],
  "ltps": [5196.88872],
  "ycps": [5183.35687],
  "opens": [5183.35687],
  "highs": [5222.12089],
  "lows": [5183.35687],
  "settlementPrices": [0.0],
  "volumes": [145230038],
  "trades": [126845],
  "values": [4609636418.1],
  "changes": [13.53185],
  "changePercentages": [0.26]
}
```

Since all fields are returned as arrays, iterate through the arrays by index and create one market snapshot record per index.

---

# Database Changes

Update the `market_snapshots` table to persist the following fields:

| Column               |
| -------------------- |
| `snapshot_date`      |
| `times`              |
| `closes`             |
| `ltps`               |
| `ycps`               |
| `opens`              |
| `highs`              |
| `lows`               |
| `settlement_prices`  |
| `volumes`            |
| `trades`             |
| `values`             |
| `changes`            |
| `change_percentages` |

Additionally:

* Store the corresponding date derived from the `times` value.
* Prevent duplicate inserts for the same market date and timestamp.
* Use an upsert mechanism if supported by the database.

---

# Model Changes

Update the following files as necessary:

### `models/market_snapshot.py`

* Add the new columns listed above.
* Update indexes and constraints if required.

### `schemas/market.py`

* Add the new properties to the request/response schemas.
* Ensure proper type definitions.

### Other Required Changes

Review and update:

* Repository layer
* CRUD functions
* API response models
* Migration scripts
* Service layer
* Dashboard queries
* Serialization logic

to ensure the new market snapshot structure is fully supported throughout the application.

---

# Backward Compatibility

* Remove all logic that depends on the old `fetch_market_trade_info` response structure.
* Refactor consumers of `market_snapshots` to use the new schema.
* Ensure existing dashboards and APIs continue to function correctly after the migration.

---

# Validation & Error Handling

* Validate that all response arrays have the same length before processing.
* Handle missing or empty arrays gracefully.
* Log malformed responses and continue processing safely.
* Ensure database transactions are rolled back on failure.

---

# Acceptance Criteria

1. `fetch_market_trade_info` uses the new `/api/share-price-histories/DSE` endpoint.
2. `Filter.from` and `Filter.to` default to the current date.
3. All market fields are stored in `market_snapshots`.
4. Duplicate records are prevented.
5. Models, schemas, migrations, and services are updated accordingly.
6. Existing functionality remains operational after the migration.
