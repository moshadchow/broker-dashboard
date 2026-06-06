# /project:types

Create `src/types/index.ts` with all TypeScript interfaces for the broker dashboard.

## File: `src/types/index.ts`

```ts
// Raw API response — Endpoint 1
export interface BrokerSummaryApiResponse {
  $id: string;
  data: {
    $id: string;
    totalExecutionReport: number;
    totalTrade:           number;
    buyTrade:             number;
    sellTrade:            number;
    totalValue:           number;
    buyValue:             number;
    sellValue:            number;
  };
  compressed: boolean;
  format:     string;
  success:    boolean;
}

// Raw API response — Endpoint 2
export interface MarketTradeInfoApiResponse {
  $id: string;
  filter: { $id: string };
  data: {
    $id:       string;
    date:      string;
    low:       number;
    volume:    number;
    trade:     number;
    value:     number;
    gainer:    number;
    loser:     number;
    unchanged: number;
  };
  compressed: boolean;
  format:     string;
  success:    boolean;
}

// Domain types
export interface BrokerData {
  totalExecutionReport: number;
  totalTrade:           number;
  buyTrade:             number;
  sellTrade:            number;
  totalValue:           number;
  buyValue:             number;
  sellValue:            number;
}

export interface BrokerRow extends BrokerData {
  brokerId:      string;
  label:         string;
  fetchError:    boolean;
  tradeSharePct: number;
  valueSharePct: number;
}

export interface AggregateRow extends BrokerData {
  tradeSharePct: number;
  valueSharePct: number;
}

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
  brokerRows:   BrokerRow[];
  aggregateRow: AggregateRow;
  marketRow:    MarketRow | null;
  loading:      boolean;
  error:        string | null;
}
```

Run `npx tsc --noEmit` after. Fix any errors before proceeding.
