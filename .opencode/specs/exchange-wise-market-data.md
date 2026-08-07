# Specification: Stock Exchange-wise Market Data Enhancement (DSE/CSE)

## Objective

Enhance the OMS data ingestion pipeline to support both **Dhaka Stock Exchange (DSE)** and **Chittagong Stock Exchange (CSE)**.

Currently, the application caches data for only one stock exchange, and the frontend Stock Exchange selection has no impact on the displayed data.

After this enhancement:

- The scheduler must fetch data for both DSE and CSE during every execution.
- Snapshot data must be stored separately for each stock exchange.
- Internal APIs must return data based on the selected stock exchange.
- The frontend must display cached data according to the selected exchange.
- Existing functionality must remain backward compatible.

---

# Functional Requirements

## 1. External OMS API Enhancement

### 1.1 Broker Summary API

Enhance the Broker Summary API request to include the selected stock exchange.

### Endpoint

```text
GET /api/broker-summary/orders-execution
```

### Required Query Parameter

```text
stockExchange=DSE
```

or

```text
stockExchange=CSE
```

### Example

#### DSE

```text
GET {base_url}/api/broker-summary/orders-execution?fromDate=2026-08-07&toDate=2026-08-07&stockExchange=DSE
```

#### CSE

```text
GET {base_url}/api/broker-summary/orders-execution?fromDate=2026-08-07&toDate=2026-08-07&stockExchange=CSE
```

---

## 1.2 Market Trade Information API

Enhance the Market Trade API to dynamically call the appropriate exchange endpoint.

### DSE

```text
GET {base_url}/api/share-price-histories/DSE
```

Parameters

```text
Filter.Symbol=DSEX
Filter.marketType=Public
Filter.resolution=1D
Filter.from=1268179200
Filter.to=1291248000
Paging.size=100000000
Paging.page=1
Paging.sortDirection=Asc
```

### CSE

```text
GET {base_url}/api/share-price-histories/CSE
```

Parameters

```text
Filter.Symbol=CSCX
Filter.marketType=Public
Filter.resolution=1D
Filter.from=1268179200
Filter.to=1291248000
Paging.size=100000000
Paging.page=1
Paging.sortDirection=Asc
```

---

## 2. Exchange Configuration

Create a centralized exchange configuration to avoid hardcoded values.

Example:

```python
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
```

The implementation must not duplicate exchange-specific logic throughout the codebase.

---

# Scheduler Enhancement

Modify the existing BackgroundScheduler so that a single execution fetches data for both stock exchanges.

Do **not** create separate scheduler jobs.

Example execution flow:

```text
Scheduler
│
├── Fetch Broker Summary (DSE)
├── Save Broker Snapshot (DSE)
├── Fetch Market Snapshot (DSE)
├── Save Market Snapshot (DSE)
│
├── Fetch Broker Summary (CSE)
├── Save Broker Snapshot (CSE)
├── Fetch Market Snapshot (CSE)
└── Save Market Snapshot (CSE)
```

Use a configurable list of supported exchanges.

Example:

```python
SUPPORTED_EXCHANGES = [
    "DSE",
    "CSE",
]
```

---

# Database Changes

Enhance the following tables:

- broker_snapshots
- market_snapshots

## Add New Column

```text
stock_exchange
```

Supported values:

- DSE
- CSE

Update:

- SQLModel models
- Database schema
- CRUD layer
- Repository layer
- Snapshot insertion logic

All snapshot queries must filter by `stock_exchange`.

---

# Internal API Enhancement

The frontend will include a Stock Exchange dropdown.

Supported values:

- DSE
- CSE

The frontend will pass the selected exchange to the internal APIs.

Example:

```text
stockExchange=DSE
```

or

```text
stockExchange=CSE
```

The backend must **not** call the OMS API during frontend requests.

Instead, it must return data from the cached snapshot tables.

Application flow:

```text
Frontend
    │
    ▼
Internal API
    │
    ▼
broker_snapshots / market_snapshots
    │
    ▼
Return exchange-specific data
```

---

# Service Layer Enhancement

Propagate the selected stock exchange through the complete request flow.

```text
Router
    │
    ▼
Service
    │
    ▼
Repository
    │
    ▼
Snapshot Tables
```

Remove any hardcoded stock exchange values.

---

# Validation

Supported values:

- DSE
- CSE

Reject invalid values such as:

- dse
- ABC
- NASDAQ
- NULL

Return appropriate validation errors.

---

# Logging

Log each exchange independently.

Include:

- Stock Exchange
- Request URL
- Response Status
- Execution Time
- Number of Records Inserted

Do not log authentication tokens or credentials.

---

# Performance Requirements

- Reuse the existing authentication token.
- Reuse the existing HTTP client.
- Avoid duplicate login requests.
- Avoid duplicate code.
- Preserve HTTP connection pooling.
- Minimize unnecessary database writes.

---

# Backward Compatibility

If `stockExchange` is not supplied by existing API consumers, default to:

```text
DSE
```

No existing API should break.

---

# Expected Deliverables

1. Enhance `fetch_broker_summary()` to support DSE and CSE.
2. Enhance `fetch_market_trade_info()` to support DSE and CSE.
3. Introduce centralized exchange configuration.
4. Update the BackgroundScheduler to fetch data for both exchanges.
5. Add `stock_exchange` to `broker_snapshots`.
6. Add `stock_exchange` to `market_snapshots`.
7. Update repository and service layers to support exchange filtering.
8. Update internal APIs to return exchange-specific cached data.
9. Implement validation for supported exchanges.
10. Add structured logging.
11. Preserve backward compatibility.
12. Ensure the implementation is scalable, maintainable, and free of duplicate logic.