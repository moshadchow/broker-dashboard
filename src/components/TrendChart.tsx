import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Brush,
} from 'recharts';
import type { TrendResponse } from '../types';

interface Props {
  trend: TrendResponse;
}

type MetricKind = 'trades' | 'value';

function fmtTick(v: number): string {
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

function CustomTooltip({
  active, payload, label,
}: {
  active?:  boolean;
  payload?: TooltipPayloadItem[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;

  const fullDate = payload[0]?.payload.fullDate ?? label;
  const displayDate = fullDate ? fmtDate(String(fullDate)) : label;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{displayDate}</p>
      {payload.map(p => {
        const isPercent = PCT_DATA_KEYS.has(p.dataKey);
        const pctFields = PCT_FIELDS[p.dataKey];
        const pctOfMarket = pctFields ? (p.payload[pctFields.market] as number | undefined) : undefined;
        const pctOfXfl = pctFields?.xfl ? (p.payload[pctFields.xfl] as number | undefined) : undefined;
        return (
          <p key={`${p.dataKey}-${p.name}`} style={{ color: p.color }}>
            {p.name}: {isPercent ? `${p.value.toFixed(2)}%` : p.value.toLocaleString()}
            {!isPercent && pctOfMarket !== undefined && ` (${pctOfMarket.toFixed(2)}% of market`}
            {!isPercent && pctOfXfl !== undefined && `, ${pctOfXfl.toFixed(2)}% of XFL`}
            {!isPercent && pctOfMarket !== undefined && ')'}
          </p>
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
  showBrush?: boolean;
}

function TrendLineChart({
  data, metric, showOwn, ownLabel, showBrush = false,
}: TrendLineChartProps) {
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

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={data}
          syncId="trade-value-trend"
          margin={{ top: 10, right: 34, left: 10, bottom: showBrush ? 34 : 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f0f0f0"
            horizontal
            vertical
          />
          <XAxis
            dataKey="date"
            height={82}
            interval={0}
            tick={{ fontSize: 11 }}
            angle={-90}
            textAnchor="end"
            tickMargin={8}
          />
          <YAxis yAxisId="actual" tickFormatter={fmtTick} tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="percent"
            orientation="right"
            tickFormatter={fmtPct}
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {showOwn && (
            <Line
              yAxisId="actual"
              type="monotone"
              dataKey={ownKey}
              name={`${ownLabel} (${labelSuffix})`}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          )}
          <Line
            yAxisId="actual"
            type="monotone"
            dataKey={xflKey}
            name={`XFL Total (${labelSuffix})`}
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="actual"
            type="monotone"
            dataKey={marketKey}
            name={`Market (${labelSuffix})`}
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="percent"
            type="monotone"
            dataKey={pctKey}
            name={pctLabel}
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
          {showBrush && (
            <Brush
              dataKey="date"
              height={18}
              travellerWidth={8}
              stroke="#94a3b8"
              tickFormatter={value => String(value)}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export default function TrendChart({ trend }: Props) {
  const data = buildData(trend);
  const showOwn = trend.trades.ownBroker !== undefined;
  const ownLabel = trend.ownBrokerLabel ?? 'Own Broker';

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Value Trend &amp; Trade Count</h2>
        <div className="h-[400px] flex items-center justify-center text-sm text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Value Trend &amp; Trade Count</h2>
      <div className="space-y-8">
        <TrendLineChart data={data} metric="value" showOwn={showOwn} ownLabel={ownLabel} showBrush />
        <TrendLineChart data={data} metric="trades" showOwn={showOwn} ownLabel={ownLabel} showBrush />
      </div>
    </div>
  );
}
