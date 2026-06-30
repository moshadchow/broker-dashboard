import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { BrokerRow, AggregateRow, MarketRow } from '../types';
import { MARKET_VALUE_UNIT_MULTIPLIER } from '../config/api';

interface Props {
  brokerRows:   BrokerRow[];
  aggregateRow: AggregateRow;
  marketRow:    MarketRow | null;
}

function fmtTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active, payload, label, marketRow,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  marketRow: MarketRow | null;
}) {
  if (!active || !payload?.length) return null;
  const tradeVal = payload.find(p => p.name === 'Total Trade')?.value ?? 0;
  const valueVal = payload.find(p => p.name === 'Total Value')?.value ?? 0;
  const tradePct = marketRow && marketRow.trade > 0
    ? ((tradeVal / marketRow.trade) * 100).toFixed(2) + '%'
    : 'N/A';
  const valuePct = marketRow && marketRow.value > 0
    ? ((valueVal / (marketRow.value * MARKET_VALUE_UNIT_MULTIPLIER)) * 100).toFixed(2) + '%'
    : 'N/A';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      <p className="text-blue-600">Trades: {tradeVal.toLocaleString()} <span className="text-gray-400">({tradePct} of market)</span></p>
      <p className="text-emerald-600">Value: {valueVal.toLocaleString()} <span className="text-gray-400">({valuePct} of market)</span></p>
    </div>
  );
}

export default function ComparisonChart({ brokerRows, aggregateRow, marketRow }: Props) {
  const data = [
    ...brokerRows.map(r => ({
      name:       r.label,
      totalTrade: r.fetchError ? 0 : r.totalTrade,
      totalValue: r.fetchError ? 0 : r.totalValue,
    })),
    {
      name:       'Aggregate',
      totalTrade: aggregateRow.totalTrade,
      totalValue: aggregateRow.totalValue,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Trade & Value Comparison</h2>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip marketRow={marketRow} />} />
          <Legend />
          <Bar dataKey="totalTrade" name="Total Trade" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="totalValue" name="Total Value" fill="#10b981" radius={[4, 4, 0, 0]} />
          {marketRow && (
            <>
              <ReferenceLine
                y={marketRow.trade}
                stroke="#3b82f6"
                strokeDasharray="5 5"
                label={{ value: 'Market Trade', position: 'insideTopRight', fontSize: 11, fill: '#3b82f6' }}
              />
              <ReferenceLine
                y={marketRow.value * MARKET_VALUE_UNIT_MULTIPLIER}
                stroke="#10b981"
                strokeDasharray="5 5"
                label={{ value: 'Market Value', position: 'insideTopLeft', fontSize: 11, fill: '#10b981' }}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
