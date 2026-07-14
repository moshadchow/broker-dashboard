import { useMemo, useState } from 'react';
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
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function fmtValue(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface LegendPayloadItem {
  value?: string | number;
  color?: string;
}

function ChartLegend({ payload, chartTheme }: {
  payload?: LegendPayloadItem[];
  chartTheme: ChartTheme;
}) {
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 pb-2 text-xs font-medium">
      {payload.map(item => (
        <span
          key={String(item.value)}
          className="inline-flex items-center gap-2"
          style={{ color: chartTheme.textSecondary }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: item.color ?? chartTheme.neutral,
              boxShadow: `0 0 0 3px ${item.color ?? chartTheme.neutral}22`,
            }}
          />
          <span>{item.value}</span>
        </span>
      ))}
    </div>
  );
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
      className="min-w-[280px] rounded-lg px-4 py-3 text-xs"
      style={{
        backgroundColor: chartTheme.tooltipBg,
        border:          `1px solid ${chartTheme.tooltipBorder}`,
        color:           chartTheme.textPrimary,
        boxShadow:       chartTheme.tooltipShadow,
      }}
    >
      <p className="mb-3 text-sm font-semibold tracking-tight">{label}</p>
      <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-5">
        <span className="inline-flex items-center gap-2" style={{ color: chartTheme.textSecondary }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartTheme.xfl }} />
          Trades
        </span>
        <span className="font-semibold tabular-nums" style={{ color: chartTheme.xfl }}>{fmtValue(tradeVal)}</span>
      </div>
      <div className="mb-3 pl-4 tabular-nums" style={{ color: chartTheme.textMuted }}>{tradePct} of market</div>
      <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-5">
        <span className="inline-flex items-center gap-2" style={{ color: chartTheme.textSecondary }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartTheme.market }} />
          Value
        </span>
        <span className="font-semibold tabular-nums" style={{ color: chartTheme.market }}>{fmtValue(valueVal)}</span>
      </div>
      <div className="pl-4 tabular-nums" style={{ color: chartTheme.textMuted }}>{valuePct} of market</div>
    </div>
  );
}

export default function ComparisonChart({ brokerRows, aggregateRow, marketRow }: Props) {
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
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
  const barOpacity = (key: string) => activeSeries && activeSeries !== key ? 0.38 : 1;

  return (
    <div className="chart-panel">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="chart-title">Trade &amp; Value Comparison</h2>
          <p className="chart-subtitle mt-1">Broker totals compared with aggregate and market benchmarks</p>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-chart-plot-bg)] px-4 pb-4 pt-3">
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 18, right: 36, left: 12, bottom: 14 }} barCategoryGap="22%" barGap={6}>
            <CartesianGrid stroke={chartTheme.grid} horizontal vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: chartTheme.axis, fontWeight: 500 }}
              axisLine={{ stroke: chartTheme.axisLine }}
              tickLine={false}
              tickMargin={10}
              minTickGap={12}
            />
            <YAxis
              tickFormatter={fmtTick}
              tick={{ fontSize: 12, fill: chartTheme.axis, fontWeight: 500 }}
              axisLine={{ stroke: chartTheme.axisLine }}
              tickLine={false}
              tickMargin={10}
              width={64}
            />
            <Tooltip
              content={<CustomTooltip marketRow={marketRow} chartTheme={chartTheme} />}
              cursor={{ fill: chartTheme.crosshair, fillOpacity: 0.08 }}
              isAnimationActive
              animationDuration={180}
            />
            <Legend
              verticalAlign="top"
              align="right"
              content={<ChartLegend chartTheme={chartTheme} />}
            />
            <Bar
              dataKey="totalTrade"
              name="Total Trade"
              fill={chartTheme.xfl}
              radius={[6, 6, 0, 0]}
              opacity={barOpacity('totalTrade')}
              animationDuration={220}
              onMouseEnter={() => setActiveSeries('totalTrade')}
              onMouseLeave={() => setActiveSeries(null)}
            />
            <Bar
              dataKey="totalValue"
              name="Total Value"
              fill={chartTheme.market}
              radius={[6, 6, 0, 0]}
              opacity={barOpacity('totalValue')}
              animationDuration={220}
              onMouseEnter={() => setActiveSeries('totalValue')}
              onMouseLeave={() => setActiveSeries(null)}
            />
            {marketRow && (
              <>
                <ReferenceLine
                  y={marketRow.trades}
                  stroke={chartTheme.xfl}
                  strokeOpacity={0.62}
                  strokeDasharray="4 6"
                  label={{ value: 'Market Trade', position: 'insideTopRight', fontSize: 12, fontWeight: 600, fill: chartTheme.xfl }}
                />
                <ReferenceLine
                  y={marketRow.values}
                  stroke={chartTheme.market}
                  strokeOpacity={0.62}
                  strokeDasharray="4 6"
                  label={{ value: 'Market Value', position: 'insideTopLeft', fontSize: 12, fontWeight: 600, fill: chartTheme.market }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
