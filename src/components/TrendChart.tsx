import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Brush, ReferenceDot,
} from 'recharts';
import { getChartTheme, type ChartTheme } from '../config/chartTheme';
import { useTheme } from '../context/ThemeContext';
import type { TrendResponse } from '../types';

interface Props {
  trend: TrendResponse;
}

type MetricKind = 'trades' | 'value';

function fmtTick(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function fmtDate(d: string): string {
  const [year, month, day] = d.split('-');
  if (!year || !month || !day) return d;
  return `${day}/${month}/${year}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(0)}%`;
}

function fmtValue(v: number, isPercent = false): string {
  if (isPercent) return `${v.toFixed(2)}%`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
}

function fmtMillions(v: number): string {
  return `${(v / 1_000_000).toFixed(2)} M`;
}

interface ChartRow {
  date:                 string;
  fullDate:             string;
  tradesOwn?:           number;
  tradesXfl:            number;
  tradesMarket:         number;
  valueOwn?:            number;
  valueXfl:             number;
  valueMarket:          number;
  pctOfMarketTrades:    number;
  pctOfXflTrades?:      number;
  pctOfMarketValue:     number;
  pctOfXflValue?:       number;
  pctXflOfMarketTrades: number;
  pctXflOfMarketValue:  number;
}

function buildData(trend: TrendResponse): ChartRow[] {
  return trend.dates.map((date, i) => {
    const tradesXfl = trend.trades.xfl[i];
    const tradesMarket = trend.trades.market[i];
    const valueXfl = trend.value.xfl[i];
    const valueMarket = trend.value.market[i];
    return {
      date,
      fullDate:             date,
      tradesOwn:            trend.trades.ownBroker?.[i],
      tradesXfl,
      tradesMarket,
      valueOwn:             trend.value.ownBroker?.[i],
      valueXfl,
      valueMarket,
      pctOfMarketTrades:    trend.trades.pctOfMarket[i],
      pctOfXflTrades:       trend.trades.pctOfXfl?.[i],
      pctOfMarketValue:     trend.value.pctOfMarket[i],
      pctOfXflValue:        trend.value.pctOfXfl?.[i],
      pctXflOfMarketTrades: tradesMarket > 0 ? (tradesXfl / tradesMarket) * 100 : 0,
      pctXflOfMarketValue:  valueMarket > 0 ? (valueXfl / valueMarket) * 100 : 0,
    };
  });
}

const PCT_FIELDS: Record<string, { market: keyof ChartRow; xfl?: keyof ChartRow }> = {
  tradesOwn: { market: 'pctOfMarketTrades', xfl: 'pctOfXflTrades' },
  tradesXfl: { market: 'pctXflOfMarketTrades' },
  valueOwn:  { market: 'pctOfMarketValue', xfl: 'pctOfXflValue' },
  valueXfl:  { market: 'pctXflOfMarketValue' },
};

const PCT_DATA_KEYS = new Set([
  'pctOfMarketTrades',
  'pctOfMarketValue',
  'pctXflOfMarketTrades',
  'pctXflOfMarketValue',
]);

interface TooltipPayloadItem {
  name:    string;
  value:   number;
  color:   string;
  dataKey: string;
  payload: ChartRow;
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
  active, payload, label, chartTheme, metric,
}: {
  active?:  boolean;
  payload?: TooltipPayloadItem[];
  label?:   string;
  chartTheme: ChartTheme;
  metric:   MetricKind;
}) {
  if (!active || !payload?.length) return null;

  const fullDate = payload[0]?.payload.fullDate ?? label;
  const displayDate = fullDate ? fmtDate(String(fullDate)) : label;

  return (
    <div
      className="min-w-[270px] rounded-lg px-4 py-3 text-xs"
      style={{
        backgroundColor: chartTheme.tooltipBg,
        border:          `1px solid ${chartTheme.tooltipBorder}`,
        color:           chartTheme.textPrimary,
        boxShadow:       chartTheme.tooltipShadow,
      }}
    >
      <p className="mb-3 text-sm font-semibold tracking-tight">{displayDate}</p>
      {payload.map(p => {
        const isPercent = PCT_DATA_KEYS.has(p.dataKey);
        const pctFields = PCT_FIELDS[p.dataKey];
        const pctOfMarket = pctFields ? (p.payload[pctFields.market] as number | undefined) : undefined;
        const pctOfXfl = pctFields?.xfl ? (p.payload[pctFields.xfl] as number | undefined) : undefined;
        return (
          <div key={`${p.dataKey}-${p.name}`} className="mb-2 last:mb-0">
            <div className="grid grid-cols-[1fr_auto] items-center gap-5">
              <span className="inline-flex items-center gap-2" style={{ color: chartTheme.textSecondary }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
              <span className="font-semibold tabular-nums" style={{ color: p.color }}>
                {(!isPercent && metric === 'value') ? fmtMillions(p.value) : fmtValue(p.value, isPercent)}
              </span>
            </div>
            {!isPercent && (pctOfMarket !== undefined || pctOfXfl !== undefined) && (
              <div className="mt-0.5 pl-4 tabular-nums" style={{ color: chartTheme.textMuted }}>
                {pctOfMarket !== undefined && `${pctOfMarket.toFixed(2)}% of market`}
                {pctOfMarket !== undefined && pctOfXfl !== undefined && ' | '}
                {pctOfXfl !== undefined && `${pctOfXfl.toFixed(2)}% of XFL`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TrendLineChartProps {
  data:     ChartRow[];
  metric:   MetricKind;
  showOwn:  boolean;
  ownLabel: string;
  chartTheme: ChartTheme;
  showBrush?: boolean;
}

function TrendLineChart({
  data, metric, showOwn, ownLabel, chartTheme, showBrush = false,
}: TrendLineChartProps) {
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
  const isTrades = metric === 'trades';
  const title = isTrades ? 'Trade Count Trend' : 'Value Trend';
  const ownKey = isTrades ? 'tradesOwn' : 'valueOwn';
  const xflKey = isTrades ? 'tradesXfl' : 'valueXfl';
  const marketKey = isTrades ? 'tradesMarket' : 'valueMarket';
  const pctKey = showOwn
    ? (isTrades ? 'pctOfMarketTrades' : 'pctOfMarketValue')
    : (isTrades ? 'pctXflOfMarketTrades' : 'pctXflOfMarketValue');
  const labelSuffix = isTrades ? 'Trades' : 'Value';
  const pctLabel = showOwn ? `${ownLabel} % of Market` : 'XFL % of Market';
  const latest = data[data.length - 1];
  const seriesOpacity = (key: string) => activeSeries && activeSeries !== key ? 0.26 : 1;
  const seriesStrokeWidth = (key: string) => activeSeries === key ? 3.2 : 2.4;
  const commonLineProps = {
    type: 'monotone' as const,
    dot: false,
    activeDot: { r: 5.5, strokeWidth: 2, stroke: chartTheme.plotBg },
    isAnimationActive: true,
    animationDuration: 220,
    onMouseLeave: () => setActiveSeries(null),
  };

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-chart-plot-bg)] px-4 pb-4 pt-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h3>
        <span className="chart-subtitle">{isTrades ? 'Counts and market share' : 'Value and market share'}</span>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart
          data={data}
          syncId="trade-value-trend"
          margin={{ top: 18, right: 36, left: 12, bottom: showBrush ? 28 : 8 }}
        >
          <CartesianGrid
            stroke={chartTheme.grid}
            horizontal
            vertical={false}
          />
          <XAxis
            dataKey="date"
            height={34}
            minTickGap={28}
            tick={{ fontSize: 12, fill: chartTheme.axis, fontWeight: 500 }}
            axisLine={{ stroke: chartTheme.axisLine }}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            yAxisId="actual"
            tickFormatter={fmtTick}
            tick={{ fontSize: 12, fill: chartTheme.axis, fontWeight: 500 }}
            axisLine={{ stroke: chartTheme.axisLine }}
            tickLine={false}
            tickMargin={10}
            width={64}
          />
          <YAxis
            yAxisId="percent"
            orientation="right"
            tickFormatter={fmtPct}
            tick={{ fontSize: 12, fill: chartTheme.axis, fontWeight: 500 }}
            axisLine={{ stroke: chartTheme.axisLine }}
            tickLine={false}
            tickMargin={10}
            width={52}
          />
          <Tooltip
            content={<CustomTooltip chartTheme={chartTheme} metric={metric} />}
            cursor={{ stroke: chartTheme.crosshair, strokeWidth: 1 }}
            isAnimationActive
            animationDuration={180}
          />
          <Legend
            verticalAlign="top"
            align="right"
            content={<ChartLegend chartTheme={chartTheme} />}
          />
          {showOwn && (
            <Line
              {...commonLineProps}
              yAxisId="actual"
              dataKey={ownKey}
              name={`${ownLabel} (${labelSuffix})`}
              stroke={chartTheme.own}
              strokeWidth={seriesStrokeWidth(ownKey)}
              opacity={seriesOpacity(ownKey)}
              onMouseEnter={() => setActiveSeries(ownKey)}
            />
          )}
          <Line
            {...commonLineProps}
            yAxisId="actual"
            dataKey={xflKey}
            name={`XFL Total (${labelSuffix})`}
            stroke={chartTheme.xfl}
            strokeWidth={seriesStrokeWidth(xflKey)}
            opacity={seriesOpacity(xflKey)}
            onMouseEnter={() => setActiveSeries(xflKey)}
          />
          <Line
            {...commonLineProps}
            yAxisId="actual"
            dataKey={marketKey}
            name={`Market (${labelSuffix})`}
            stroke={chartTheme.market}
            strokeWidth={seriesStrokeWidth(marketKey)}
            opacity={seriesOpacity(marketKey)}
            onMouseEnter={() => setActiveSeries(marketKey)}
          />
          <Line
            {...commonLineProps}
            yAxisId="percent"
            dataKey={pctKey}
            name={pctLabel}
            stroke={chartTheme.percent}
            strokeWidth={seriesStrokeWidth(pctKey)}
            strokeDasharray="5 5"
            opacity={seriesOpacity(pctKey)}
            onMouseEnter={() => setActiveSeries(pctKey)}
          />
          {latest && showOwn && latest[ownKey] !== undefined && (
            <ReferenceDot yAxisId="actual" x={latest.date} y={latest[ownKey]} r={4.5} fill={chartTheme.own} stroke={chartTheme.plotBg} strokeWidth={2} />
          )}
          {latest && (
            <>
              <ReferenceDot yAxisId="actual" x={latest.date} y={latest[xflKey]} r={4.5} fill={chartTheme.xfl} stroke={chartTheme.plotBg} strokeWidth={2} />
              <ReferenceDot yAxisId="actual" x={latest.date} y={latest[marketKey]} r={4.5} fill={chartTheme.market} stroke={chartTheme.plotBg} strokeWidth={2} />
              <ReferenceDot yAxisId="percent" x={latest.date} y={latest[pctKey]} r={4.5} fill={chartTheme.percent} stroke={chartTheme.plotBg} strokeWidth={2} />
            </>
          )}
          {showBrush && (
            <Brush
              dataKey="date"
              height={20}
              travellerWidth={8}
              stroke={chartTheme.brush}
              fill={chartTheme.brushBg}
              tickFormatter={value => String(value)}
              y={330}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export default function TrendChart({ trend }: Props) {
  const { theme } = useTheme();
  const chartTheme = useMemo(() => getChartTheme(theme), [theme]);
  const data = buildData(trend);
  const showOwn = trend.trades.ownBroker !== undefined;
  const ownLabel = trend.ownBrokerLabel ?? 'Own Broker';

  if (data.length === 0) {
    return (
      <div className="chart-panel">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="chart-title">Value Trend &amp; Trade Count</h2>
            <p className="chart-subtitle mt-1">Synchronized market, XFL, and broker trend analysis</p>
          </div>
        </div>
        <div className="h-[400px] flex items-center justify-center text-sm text-[var(--color-text-muted)]">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="chart-panel">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="chart-title">Value Trend &amp; Trade Count</h2>
          <p className="chart-subtitle mt-1">Synchronized market, XFL, and broker trend analysis</p>
        </div>
      </div>
      <div className="space-y-5">
        <TrendLineChart data={data} metric="value" showOwn={showOwn} ownLabel={ownLabel} chartTheme={chartTheme} showBrush />
        <TrendLineChart data={data} metric="trades" showOwn={showOwn} ownLabel={ownLabel} chartTheme={chartTheme} showBrush />
      </div>
    </div>
  );
}
