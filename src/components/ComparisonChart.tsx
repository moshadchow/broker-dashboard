import { useMemo } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { getChartTheme, type ChartTheme } from '../config/chartTheme';
import { useTheme } from '../context/ThemeContext';
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
  active, payload, label, marketRow, chartTheme,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  marketRow: MarketRow | null;
  chartTheme: ChartTheme;
}) {
  if (!active || !payload?.length) return null;
  const tradeVal = payload.find(p => p.name === 'Total Trade')?.value ?? 0;
  const valueVal = payload.find(p => p.name === 'Total Value')?.value ?? 0;
  const tradePct = marketRow && marketRow.trades > 0
    ? ((tradeVal / marketRow.trades) * 100).toFixed(2) + '%'
    : 'N/A';
  const valuePct = marketRow && marketRow.values > 0
    ? ((Number(valueVal) / Number(marketRow.values)) * 100).toFixed(2) + '%'
    : 'N/A';

  return (
    <div
      className="rounded-lg shadow-lg px-4 py-3 text-sm"
      style={{
        backgroundColor: chartTheme.tooltipBg,
        border:          `1px solid ${chartTheme.tooltipBorder}`,
        color:           chartTheme.textPrimary,
      }}
    >
      <p className="font-bold mb-2">{label}</p>
      <p style={{ color: chartTheme.xfl }}>Trades: {tradeVal.toLocaleString()} <span style={{ color: chartTheme.textSecondary }}>({tradePct} of market)</span></p>
      <p style={{ color: chartTheme.market }}>Value: {valueVal.toLocaleString()} <span style={{ color: chartTheme.textSecondary }}>({valuePct} of market)</span></p>
    </div>
  );
}

export default function ComparisonChart({ brokerRows, aggregateRow, marketRow }: Props) {
  const { theme } = useTheme();
  const chartTheme = useMemo(() => getChartTheme(theme), [theme]);
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
    <div className="panel-pad">
      <h2 className="text-base font-semibold text-[var(--color-text-secondary)] mb-4">Trade & Value Comparison</h2>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: chartTheme.axis }}
            axisLine={{ stroke: chartTheme.axis }}
            tickLine={{ stroke: chartTheme.axis }}
          />
          <YAxis
            tickFormatter={fmtTick}
            tick={{ fontSize: 11, fill: chartTheme.axis }}
            axisLine={{ stroke: chartTheme.axis }}
            tickLine={{ stroke: chartTheme.axis }}
          />
          <Tooltip content={<CustomTooltip marketRow={marketRow} chartTheme={chartTheme} />} />
          <Legend wrapperStyle={{ color: chartTheme.textSecondary }} />
          <Bar dataKey="totalTrade" name="Total Trade" fill={chartTheme.xfl} radius={[4, 4, 0, 0]} />
          <Bar dataKey="totalValue" name="Total Value" fill={chartTheme.market} radius={[4, 4, 0, 0]} />
          {marketRow && (
            <>
              <ReferenceLine
                y={marketRow.trades}
                stroke={chartTheme.xfl}
                strokeDasharray="5 5"
                label={{ value: 'Market Trade', position: 'insideTopRight', fontSize: 11, fill: chartTheme.xfl }}
              />
              <ReferenceLine
                y={marketRow.values}
                stroke={chartTheme.market}
                strokeDasharray="5 5"
                label={{ value: 'Market Value', position: 'insideTopLeft', fontSize: 11, fill: chartTheme.market }}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
