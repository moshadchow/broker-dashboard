import { useState, useEffect } from 'react';
import { BROKERS } from '../config/brokers';
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
        fetchInternalBrokerData().catch(() => null),
        fetchInternalMarketData().catch(() => null),
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

      if (marketResp?.market) {
        const d = marketResp.market;
        marketRow = { ...d };
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
