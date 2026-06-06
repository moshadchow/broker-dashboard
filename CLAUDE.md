# CLAUDE.md — Broker Execution vs Market Comparison Dashboard

## Project Overview

React dashboard fetching order-execution data per broker (endpoint 1) and market-wide aggregated trade info (endpoint 2), rendering a comparison data table + Recharts chart.

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18 + TypeScript               |
| Charts   | Recharts                            |
| Styling  | Tailwind CSS                        |
| HTTP     | Axios                               |
| Config   | Hardcoded broker IDs, env-based JWT |

---

## Directory Structure

```
src/
├── config/
│   ├── brokers.ts          # Static XBrokerId list
│   └── api.ts              # Base URL, endpoint templates, thresholds
├── services/
│   └── apiService.ts       # Axios calls for both endpoints
├── hooks/
│   └── useDashboardData.ts # Orchestrates parallel fetches + aggregation
├── components/
│   ├── Dashboard.tsx       # Root layout
│   ├── FilterBar.tsx       # Date range + stock exchange inputs
│   ├── ComparisonTable.tsx # Data table: per-broker + aggregate vs market
│   └── ComparisonChart.tsx # Recharts ComposedChart
├── types/
│   └── index.ts            # All shared TS interfaces
└── App.tsx
```

---

## Configuration

### `src/config/brokers.ts`

```ts
export interface Broker {
  id: string;    // value sent as X-BrokerId header
  label: string; // display name in table/chart
}

export const BROKERS: Broker[] = [
  { id: "cdhvcbbhhurtuu",      label: "SNM" },
  { id: "hgdchhhgjvvvvbbhhhb", label: "BAL" },
  // add more brokers here
];
```

### `src/config/api.ts`

```ts
export const BASE_URL = "https://uat.xfltrade.com:20121";

export const ENDPOINTS = {
  brokerSummary: (fromDate: string, toDate: string) =>
    `/api/broker-summary/orders-execution?fromDate=${fromDate}&toDate=${toDate}`,
  marketTradeInfo: (stockExchange: string) =>
    `/api/indexes/${encodeURIComponent(stockExchange)}/market-trade-info`,
};

// Threshold for market-share color coding (%)
export const MARKET_SHARE_THRESHOLD = 5;
```

> JWT set via `VITE_JWT_TOKEN` in `.env.local` — never commit.

```
# .env.local
VITE_JWT_TOKEN=your_jwt_here
```

---

## API Contract (Actual Response Shapes)

### Endpoint 1 — Broker Summary

```
GET /api/broker-summary/orders-execution?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
Headers:
  X-BrokerId:    <broker.id>
  Authorization: Bearer <JWT>
```

**Response:**
```ts
interface BrokerSummaryApiResponse {
  $id: string;
  data: {
    $id: string;
    totalExecutionReport: number; // total order execution reports
    totalTrade:           number; // total matched trades
    buyTrade:             number;
    sellTrade:            number;
    totalValue:           number; // in crore BDT or market unit
    buyValue:             number;
    sellValue:            number;
  };
  compressed: boolean;
  format:     string;
  success:    boolean;
}
```

Called **once per broker** in parallel via `Promise.all`.  
If `success === false`, mark broker row with `fetchError: true`.

### Endpoint 2 — Market Aggregated Trade Info

```
GET /api/indexes/{stockExchange}/market-trade-info
Headers:
  Authorization: Bearer <JWT>
```

**Response:**
```ts
interface MarketTradeInfoApiResponse {
  $id: string;
  filter: { $id: string };
  data: {
    $id:       string;
    date:      string;  // ISO datetime
    low:       number;
    volume:    number;  // total market volume (shares)
    trade:     number;  // total market trades
    value:     number;  // total market value
    gainer:    number;  // count of gaining scripts
    loser:     number;
    unchanged: number;
  };
  compressed: boolean;
  format:     string;
  success:    boolean;
}
```

Called **once** per stock exchange selection.

---

## TypeScript Interfaces (`src/types/index.ts`)

```ts
// Unwrapped broker data per broker fetch
export interface BrokerData {
  totalExecutionReport: number;
  totalTrade:           number;
  buyTrade:             number;
  sellTrade:            number;
  totalValue:           number;
  buyValue:             number;
  sellValue:            number;
}

// Per-broker table row (includes broker identity + derived metrics)
export interface BrokerRow extends BrokerData {
  brokerId:   string;
  label:      string;
  fetchError: boolean;
  // derived:
  tradeSharePct:  number; // broker totalTrade / market.trade * 100
  valueSharePct:  number; // broker totalValue / market.value * 100
}

// Summed across all brokers
export interface AggregateRow extends BrokerData {
  tradeSharePct: number;
  valueSharePct: number;
}

// Unwrapped market data
export interface MarketRow {
  date:      string;
  low:       number;
  volume:    number;
  trade:     number;
  value:     number;
  gainer:    number;
  loser:     number;
  unchanged: number;
}

export interface DashboardParams {
  fromDate:      string;
  toDate:        string;
  stockExchange: string;
}

export interface DashboardData {
  brokerRows:    BrokerRow[];
  aggregateRow:  AggregateRow;
  marketRow:     MarketRow | null;
  loading:       boolean;
  error:         string | null;
}
```

---

## Data Aggregation Logic

After all fetches resolve:

```
aggregateRow.totalTrade  = sum(brokerRows[i].totalTrade)
aggregateRow.totalValue  = sum(brokerRows[i].totalValue)
aggregateRow.buyTrade    = sum(brokerRows[i].buyTrade)
aggregateRow.sellTrade   = sum(brokerRows[i].sellTrade)
aggregateRow.buyValue    = sum(brokerRows[i].buyValue)
aggregateRow.sellValue   = sum(brokerRows[i].sellValue)
aggregateRow.totalExecutionReport = sum(brokerRows[i].totalExecutionReport)

// Derived share metrics (against market endpoint 2 data):
brokerRow.tradeSharePct  = brokerRow.totalTrade  / marketRow.trade * 100
brokerRow.valueSharePct  = brokerRow.totalValue  / marketRow.value * 100
aggregateRow.tradeSharePct = aggregateRow.totalTrade  / marketRow.trade * 100
aggregateRow.valueSharePct = aggregateRow.totalValue  / marketRow.value * 100
```

---

## Components

### `FilterBar`

Inputs:
- `fromDate` — date picker, default today
- `toDate` — date picker, default today
- `stockExchange` — text input or select, default `"DSE"`
- **Fetch** button → triggers `useDashboardData` reload

### `ComparisonTable`

Columns:

| Broker | Exec Reports | Total Trade | Buy Trade | Sell Trade | Total Value | Buy Value | Sell Value | Trade Share % | Value Share % |
|--------|-------------|-------------|-----------|------------|-------------|-----------|------------|---------------|---------------|
| SNM    | …           | …           | …         | …          | …           | …         | …          | colored %     | colored %     |
| BAL    | …           | …           | …         | …          | …           | …         | …          | colored %     | colored %     |
| **Σ Aggregate** | … | …      | …         | …          | …           | …         | …          | …             | …             |
| **Market** | —      | `trade`     | —         | —          | `value`     | —         | —          | 100%          | 100%          |

Color rules for share % cells:
- `>= MARKET_SHARE_THRESHOLD` → green badge
- `< MARKET_SHARE_THRESHOLD` → amber badge
- `fetchError` row → red/strikethrough

### `ComparisonChart`

`ComposedChart` with two chart groups:

**Group A — Trade Count:**
- `Bar` per broker: `totalTrade`
- `Bar` aggregate: `aggregateRow.totalTrade`
- `ReferenceLine` at `marketRow.trade`

**Group B — Value:**
- `Bar` per broker: `totalValue`
- `Bar` aggregate: `aggregateRow.totalValue`
- `ReferenceLine` at `marketRow.value`

X-axis: broker labels + "Aggregate"  
Tooltip: absolute value + share %

---

## `useDashboardData` Hook

```ts
// src/hooks/useDashboardData.ts
function useDashboardData(params: DashboardParams): DashboardData

// Internal flow:
// 1. Promise.all → fetch endpoint 1 for each broker in BROKERS
// 2. fetch endpoint 2 for stockExchange
// 3. Map raw API responses → BrokerRow[] (with fetchError flag)
// 4. Compute aggregateRow
// 5. Compute per-row derived share metrics against marketRow
// 6. Return { brokerRows, aggregateRow, marketRow, loading, error }
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Single broker 4xx/5xx | `fetchError: true` on that row; rest continue |
| All brokers fail | Full error state + retry button |
| Market endpoint fails | Banner warning; share % columns show `N/A` |
| `success: false` in body | Treat as fetch error |
| 401 on any call | Show re-auth banner; stop further fetches |

---

## Hardcoded vs Configurable

| Item | Type | Location |
|------|------|----------|
| Broker IDs + labels | Hardcoded | `config/brokers.ts` |
| Base URL | Hardcoded | `config/api.ts` |
| JWT Token | Env var | `.env.local` → `VITE_JWT_TOKEN` |
| Market share threshold | Hardcoded const | `config/api.ts` |
| Date range | UI-configurable | `FilterBar` |
| Stock Exchange | UI-configurable | `FilterBar` |

---

## Setup

```bash
npm create vite@latest broker-dashboard -- --template react-ts
cd broker-dashboard
npm install recharts axios tailwindcss @tailwindcss/vite
```

**`vite.config.ts`:**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://uat.xfltrade.com:20121',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

> With proxy active, set `BASE_URL = ""` in `config/api.ts` for dev.  
> For prod build, set `BASE_URL = "https://uat.xfltrade.com:20121"` or inject via env.

**`.env.local`:**
```
VITE_JWT_TOKEN=<your_token>
```

```bash
npm run dev
```

---

## Key Notes

- `$id` fields in all responses are serialization artifacts — ignore them, do not map to UI.
- `date: "0001-01-01T00:00:00"` in market response = server returning default when no date filter applies to endpoint 2 — display as `"—"` in UI.
- `value` in market response appears to be in a different unit than broker `totalValue` — verify units with backend before computing share % (may need a multiplier).
- Endpoint 2 takes **no** `X-BrokerId` header — only `Authorization: Bearer`. Do not send it.

---

## Future Enhancements (Out of Scope)

- Auth flow / token refresh
- Export to CSV/XLSX
- Date range presets (Today, Last 7 days)
- Multi-exchange tabs
- WebSocket live updates
