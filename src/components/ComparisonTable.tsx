import { MARKET_SHARE_THRESHOLD } from '../config/api';
import type { BrokerRow, AggregateRow, MarketRow } from '../types';

interface Props {
  brokerRows:   BrokerRow[];
  aggregateRow: AggregateRow;
  marketRow:    MarketRow | null;
  stockExchange: string;
  showBrokerRows: boolean;
}

function ShareBadge({ pct, isMarket, noData }: { pct: number; isMarket?: boolean; noData?: boolean }) {
  if (noData) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">N/A</span>;
  if (isMarket) return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-semibold">100%</span>;
  const color = pct >= MARKET_SHARE_THRESHOLD
    ? 'bg-green-100 text-green-800'
    : 'bg-amber-100 text-amber-800';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{pct.toFixed(2)}%</span>;
}

function fmt(n: number) { return n.toLocaleString(); }

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
    {children}
  </th>
);

const TD = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${className}`}>{children}</td>
);

export default function ComparisonTable({
  brokerRows,
  aggregateRow,
  marketRow,
  stockExchange,
  showBrokerRows,
}: Props) {
  const noMarket = marketRow === null;
  const marketLabel = stockExchange.trim() || 'DSE';

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <TH>Broker</TH>
            <TH>Exec Reports</TH>
            <TH>Total Trade</TH>
            <TH>Buy Trade</TH>
            <TH>Sell Trade</TH>
            <TH>Total Value</TH>
            <TH>Buy Value</TH>
            <TH>Sell Value</TH>
            <TH>Trade Share %</TH>
            <TH>Value Share %</TH>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {showBrokerRows && brokerRows.map(row => (
            <tr key={row.brokerId} className={row.fetchError ? 'bg-red-50' : 'hover:bg-gray-50'}>
              <TD className="font-medium">
                {row.label}
                {row.fetchError && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">Error</span>
                )}
              </TD>
              {row.fetchError ? (
                Array.from({ length: 9 }).map((_, i) => <TD key={i}>—</TD>)
              ) : (
                <>
                  <TD>{fmt(row.totalExecutionReport)}</TD>
                  <TD>{fmt(row.totalTrade)}</TD>
                  <TD>{fmt(row.buyTrade)}</TD>
                  <TD>{fmt(row.sellTrade)}</TD>
                  <TD>{fmt(row.totalValue)}</TD>
                  <TD>{fmt(row.buyValue)}</TD>
                  <TD>{fmt(row.sellValue)}</TD>
                  <TD><ShareBadge pct={row.tradeSharePct} noData={noMarket} /></TD>
                  <TD><ShareBadge pct={row.valueSharePct} noData={noMarket} /></TD>
                </>
              )}
            </tr>
          ))}

          {/* Aggregate row */}
          <tr className="bg-blue-50 font-semibold">
            <TD className="font-bold text-blue-800">Σ XFL</TD>
            <TD>{fmt(aggregateRow.totalExecutionReport)}</TD>
            <TD>{fmt(aggregateRow.totalTrade)}</TD>
            <TD>{fmt(aggregateRow.buyTrade)}</TD>
            <TD>{fmt(aggregateRow.sellTrade)}</TD>
            <TD>{fmt(aggregateRow.totalValue)}</TD>
            <TD>{fmt(aggregateRow.buyValue)}</TD>
            <TD>{fmt(aggregateRow.sellValue)}</TD>
            <TD><ShareBadge pct={aggregateRow.tradeSharePct} noData={noMarket} /></TD>
            <TD><ShareBadge pct={aggregateRow.valueSharePct} noData={noMarket} /></TD>
          </tr>

          {/* Market row */}
          <tr className="bg-gray-50 border-t-2 border-gray-300">
            <TD className="font-bold text-gray-600">{marketLabel}</TD>
            <TD>—</TD>
            <TD>{marketRow ? fmt(marketRow.trades) : '—'}</TD>
            <TD>—</TD>
            <TD>—</TD>
            <TD>{marketRow ? fmt(marketRow.values) : '—'}</TD>
            <TD>—</TD>
            <TD>—</TD>
            <TD><ShareBadge pct={100} isMarket noData={noMarket} /></TD>
            <TD><ShareBadge pct={100} isMarket noData={noMarket} /></TD>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
