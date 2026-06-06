# /project:hook

Create `src/hooks/useDashboardData.ts`.

## Behaviour
- Uses `Promise.allSettled` for broker fetches — one failure must NOT abort others.
- Market fetch failure → set `error` banner, keep `marketRow: null`, set all share pcts to 0.
- Re-runs when `params` object reference changes (controlled by parent via fetchTrigger).

## File: `src/hooks/useDashboardData.ts`

```ts
import { useState, useEffect } from 'react';
import { BROKERS } from '../config/brokers';
import { fetchBrokerSummary, fetchMarketTradeInfo } from '../services/apiService';
import type {
  DashboardParams,
  DashboardData,
  BrokerRow,
  AggregateRow,
  MarketRow,
} from '../types';

const ZERO_BROKER_DATA = {
  totalExecutionReport: 0,
  totalTrade: 0,
  buyTrade: 0,
  sellTrade: 0,
  totalValue: 0,
  buyValue: 0,
  sellValue: 0,
};

export function useDashboardData(params: DashboardParams): DashboardData {
  const [state, setState] = useState<DashboardData>({
    brokerRows:   [],
    aggregateRow: { ...ZERO_BROKER_DATA, tradeSharePct: 0, valueSharePct: 0 },
    marketRow:    null,
    loading:      false,
    error:        null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState(s => ({ ...s, loading: true, error: null }));

      // Parallel: all brokers + market
      const [brokerResults, marketResult] = await Promise.all([
        Promise.allSettled(
          BROKERS.map(b =>
            fetchBrokerSummary(b.id, params.fromDate, params.toDate)
              .then(r => ({ broker: b, data: r.data }))
          )
        ),
        fetchMarketTradeInfo(params.stockExchange).catch(() => null),
      ]);

      if (cancelled) return;

      // Map broker results → BrokerRow[]
      const brokerRows: BrokerRow[] = brokerResults.map((result, i) => {
        if (result.status === 'fulfilled') {
          return {
            brokerId:   BROKERS[i].id,
            label:      BROKERS[i].label,
            fetchError: false,
            tradeSharePct: 0,
            valueSharePct: 0,
            ...result.value.data,
          };
        }
        return {
          brokerId:   BROKERS[i].id,
          label:      BROKERS[i].label,
          fetchError: true,
          tradeSharePct: 0,
          valueSharePct: 0,
          ...ZERO_BROKER_DATA,
        };
      });

      // Aggregate
      const aggregateRow: AggregateRow = {
        tradeSharePct: 0,
        valueSharePct: 0,
        totalExecutionReport: brokerRows.reduce((s, r) => s + r.totalExecutionReport, 0),
        totalTrade:  brokerRows.reduce((s, r) => s + r.totalTrade,  0),
        buyTrade:    brokerRows.reduce((s, r) => s + r.buyTrade,    0),
        sellTrade:   brokerRows.reduce((s, r) => s + r.sellTrade,   0),
        totalValue:  brokerRows.reduce((s, r) => s + r.totalValue,  0),
        buyValue:    brokerRows.reduce((s, r) => s + r.buyValue,    0),
        sellValue:   brokerRows.reduce((s, r) => s + r.sellValue,   0),
      };

      // Market + derived share %
      let marketRow: MarketRow | null = null;
      let error: string | null = null;

      if (marketResult) {
        const d = marketResult.data;
        marketRow = {
          date: d.date, low: d.low, volume: d.volume,
          trade: d.trade, value: d.value,
          gainer: d.gainer, loser: d.loser, unchanged: d.unchanged,
        };
        // Compute share pcts
        if (d.trade > 0) {
          brokerRows.forEach(r => { r.tradeSharePct = r.totalTrade / d.trade * 100; });
          aggregateRow.tradeSharePct = aggregateRow.totalTrade / d.trade * 100;
        }
        if (d.value > 0) {
          brokerRows.forEach(r => { r.valueSharePct = r.totalValue / d.value * 100; });
          aggregateRow.valueSharePct = aggregateRow.totalValue / d.value * 100;
        }
      } else {
        error = 'Market data unavailable — share % disabled.';
      }

      setState({ brokerRows, aggregateRow, marketRow, loading: false, error });
    }

    load();
    return () => { cancelled = true; };
  }, [params]);

  return state;
}
```
