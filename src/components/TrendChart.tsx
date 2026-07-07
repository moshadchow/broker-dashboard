import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { TrendResponse } from '../types';

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
  date:                  string;
  tradesOwn?:            number;
  tradesXfl:             number;
  tradesMarket:          number;
  valueOwn?:             number;
  valueXfl:              number;
  valueMarket:           number;
  pctOfMarketTrades:     number;
  pctOfXflTrades?:       number;
  pctOfMarketValue:      number;
  pctOfXflValue?:        number;
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
      date:              fmtDate(date),
      tradesOwn:         trend.trades.ownBroker?.[i],
      tradesXfl,
      tradesMarket,
      valueOwn:          trend.value.ownBroker?.[i],
      valueXfl,
      valueMarket,
      pctOfMarketTrades: trend.trades.pctOfMarket[i],
      pctOfXflTrades:    trend.trades.pctOfXfl?.[i],
      pctOfMarketValue:  trend.value.pctOfMarket[i],
      pctOfXflValue:     trend.value.pctOfXfl?.[i],
      pctXflOfMarketTrades: tradesMarket > 0 ? (tradesXfl / tradesMarket) * 100 : 0,
      pctXflOfMarketValue:  valueMarket > 0 ? (valueXfl / valueMarket) * 100 : 0,
    };
  });
}

const PCT_FIELDS: Record<string, { market: keyof ChartRow; xfl?: keyof ChartRow }> = {
  tradesOwn:    { market: 'pctOfMarketTrades', xfl: 'pctOfXflTrades' },
  tradesXfl:    { market: 'pctXflOfMarketTrades' },
  valueOwn:     { market: 'pctOfMarketValue', xfl: 'pctOfXflValue' },
  valueXfl:     { market: 'pctXflOfMarketValue' },
};

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

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map(p => {
        const pctFields = PCT_FIELDS[p.dataKey];
        const pctOfMarket = pctFields ? (p.payload[pctFields.market] as number | undefined) : undefined;
        const pctOfXfl = pctFields?.xfl ? (p.payload[pctFields.xfl] as number | undefined) : undefined;
        return (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value.toLocaleString()}
            {pctOfMarket !== undefined && ` (${pctOfMarket.toFixed(2)}% of market`}
            {pctOfXfl !== undefined && `, ${pctOfXfl.toFixed(2)}% of XFL`}
            {pctOfMarket !== undefined && ')'}
          </p>
        );
      })}
    </div>
  );
}

export default function TrendChart({ trend }: Props) {
  const data = buildData(trend);
  const showOwn = trend.trades.ownBroker !== undefined;
  const ownLabel = trend.ownBrokerLabel ?? 'Own Broker';

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Trade Count &amp; Value Trend</h2>
        <div className="h-[400px] flex items-center justify-center text-sm text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Trade Count &amp; Value Trend</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="trades" tickFormatter={fmtTick} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="value" orientation="right" tickFormatter={(v: number) => v.toLocaleString()} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {showOwn && (
            <Line
              yAxisId="trades"
              type="monotone"
              dataKey="tradesOwn"
              name={`${ownLabel} (Trades)`}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          )}
          <Line yAxisId="trades" type="monotone" dataKey="tradesXfl" name="XFL Total (Trades)" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line yAxisId="trades" type="monotone" dataKey="tradesMarket" name="Market (Trades)" stroke="#10b981" strokeWidth={2} dot={false} />
          {showOwn && (
            <Line
              yAxisId="value"
              type="monotone"
              dataKey="valueOwn"
              name={`${ownLabel} (Value)`}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
          <Line yAxisId="value" type="monotone" dataKey="valueXfl" name="XFL Total (Value)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          <Line yAxisId="value" type="monotone" dataKey="valueMarket" name="Market (Value)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
