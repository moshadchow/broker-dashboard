# /project:config

Create `src/config/brokers.ts` and `src/config/api.ts`.

## File: `src/config/brokers.ts`

```ts
export interface Broker {
  id: string;    // sent as X-BrokerId request header
  label: string; // display name in table and chart
}

export const BROKERS: Broker[] = [
  { id: "cdhvcbbhhurtuu",      label: "SNM" },
  { id: "hgdchhhgjvvvvbbhhhb", label: "BAL" },
  // Add more brokers here following the same shape
];
```

## File: `src/config/api.ts`

```ts
// Empty string = Vite proxy handles routing in dev.
// For production build set to: "https://uat.xfltrade.com:20121"
export const BASE_URL = "";

export const ENDPOINTS = {
  brokerSummary: (fromDate: string, toDate: string): string =>
    `/api/broker-summary/orders-execution?fromDate=${fromDate}&toDate=${toDate}`,

  marketTradeInfo: (stockExchange: string): string =>
    `/api/indexes/${encodeURIComponent(stockExchange)}/market-trade-info`,
};

// Share % cells: green if >= threshold, amber if below
export const MARKET_SHARE_THRESHOLD = 5;
```
