import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { TrendResponse, TrendSeries } from '../types';

interface Props {
  trend: TrendResponse;
}

function fmtTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function fmtDate(d: string): string {
  const [, month, day] = d.split('-');
  return `${month}/${day}`;
}

interface ChartRow {
  date:         string;
  ownBroker?:   number;
  xfl:          number;
  market:       number;
  pctOfXfl?:    number;
  pctOfMarket:  number;
}

function buildData(dates: string[], series: TrendSeries): ChartRow[] {
  return dates.map((date, i) => ({
    date:        fmtDate(date),
    ownBroker:   series.ownBroker?.[i],
    xfl:         series.xfl[i],
    market:      series.market[i],
    pctOfXfl:    series.pctOfXfl?.[i],
    pctOfMarket: series.pctOfMarket[i],
  }));
}

interface TooltipPayloadItem {
  name:    string;
  value:   number;
  color:   string;
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
  const row = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
      <p className="text-gray-400 mt-1">
        % of market: {row.pctOfMarket.toFixed(2)}%
        {row.pctOfXfl !== undefined && ` · % of XFL: ${row.pctOfXfl.toFixed(2)}%`}
      </p>
    </div>
  );
}

function SeriesChart({
  title, dates, series, ownLabel,
}: {
  title:    string;
  dates:    string[];
  series:   TrendSeries;
  ownLabel: string | null;
}) {
  const data = buildData(dates, series);
  const showOwn = series.ownBroker !== undefined;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-700 mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {showOwn && (
            <Line
              type="monotone"
              dataKey="ownBroker"
              name={ownLabel ?? 'Own Broker'}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          )}
          <Line type="monotone" dataKey="xfl" name="XFL Total" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="market" name="Market" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TrendChart({ trend }: Props) {
  const ownLabel = trend.ownBrokerLabel ?? null;
  return (
    <div className="space-y-6">
      <SeriesChart title="Trade Count Trend" dates={trend.dates} series={trend.trades} ownLabel={ownLabel} />
      <SeriesChart title="Value Trend" dates={trend.dates} series={trend.value} ownLabel={ownLabel} />
    </div>
  );
}
