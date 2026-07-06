import { useState, useEffect } from 'react';
import { BROKERS } from '../config/brokers';
import { MARKET_VALUE_UNIT_MULTIPLIER } from '../config/api';
import { fetchInternalBrokerData, fetchInternalMarketData } from '../services/apiService';
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

      const [brokerResp, marketResp] = await Promise.all([
        fetchInternalBrokerData(params.toDate).catch(() => null),
        fetchInternalMarketData(params.toDate).catch(() => null),
      ]);

      if (cancelled) return;

      // Map broker results → BrokerRow[]
      const brokerRows: BrokerRow[] = brokerResp
        ? brokerResp.brokers.map(b => ({
            ...b,
            tradeSharePct: 0,
            valueSharePct: 0,
          }))
        : BROKERS.map(b => ({
            brokerId:   b.id,
            label:      b.label,
            fetchError: true,
            tradeSharePct: 0,
            valueSharePct: 0,
            ...ZERO_BROKER_DATA,
          }));

      // Aggregate (XFL-wide, summed server-side across all brokers — independent of which
      // broker rows are visible to this user)
      const aggregateRow: AggregateRow = brokerResp
        ? { ...brokerResp.aggregate, tradeSharePct: 0, valueSharePct: 0 }
        : { ...ZERO_BROKER_DATA, tradeSharePct: 0, valueSharePct: 0 };

      // Market + derived share %
      let marketRow: MarketRow | null = null;
      let error: string | null = null;

      if (marketResp?.market) {
        const d = marketResp.market;
        marketRow = { ...d };
        // Compute share pcts
        if (d.trades > 0) {
          brokerRows.forEach(r => { r.tradeSharePct = r.totalTrade / d.trades * 100; });
          aggregateRow.tradeSharePct = aggregateRow.totalTrade / d.trades * 100;
        }
        const marketValue = d.values * MARKET_VALUE_UNIT_MULTIPLIER;
        if (marketValue > 0) {
          brokerRows.forEach(r => { r.valueSharePct = r.totalValue / marketValue * 100; });
          aggregateRow.valueSharePct = aggregateRow.totalValue / marketValue * 100;
        }
      } else {
        error = 'Market data unavailable — share % disabled.';
      }

      if (!brokerResp) {
        error = 'Broker data unavailable — internal API unreachable.';
      }

      setState({ brokerRows, aggregateRow, marketRow, loading: false, error });
    }

    load();
    return () => { cancelled = true; };
  }, [params]);

  return state;
}
