# /project:chart

Create `src/components/ComparisonChart.tsx`.

## Props
```ts
interface ComparisonChartProps {
  brokerRows:   BrokerRow[];
  aggregateRow: AggregateRow;
  marketRow:    MarketRow | null;
}
```

## Chart spec
- Recharts `ComposedChart` inside `ResponsiveContainer` (width 100%, height 360)
- Chart data array: one entry per broker + one "Aggregate" entry
- Two `Bar` series: `totalTrade` (blue #3b82f6) and `totalValue` (emerald #10b981)
- If `marketRow !== null`: two `ReferenceLine` — one at `marketRow.trade` (blue dashed), one at `marketRow.value` (emerald dashed), each with a label
- `XAxis` dataKey="name"
- `YAxis` with `tickFormatter` compressing large numbers: ≥1_000_000 → "1M", ≥1_000 → "1K"
- `Tooltip` showing name, totalTrade, totalValue, and share % (compute inline from marketRow)
- `Legend`
- `CartesianGrid` strokeDasharray="3 3"

## File: `src/components/ComparisonChart.tsx`

```tsx
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { BrokerRow, AggregateRow, MarketRow } from '../types';

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
  const tradeVal = payload.find(p => p.name === 'totalTrade')?.value ?? 0;
  const valueVal = payload.find(p => p.name === 'totalValue')?.value ?? 0;
  const tradePct = marketRow && marketRow.trade > 0
    ? ((tradeVal / marketRow.trade) * 100).toFixed(2) + '%'
    : 'N/A';
  const valuePct = marketRow && marketRow.value > 0
    ? ((valueVal / marketRow.value) * 100).toFixed(2) + '%'
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
                y={marketRow.value}
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
```
