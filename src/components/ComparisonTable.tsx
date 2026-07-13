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
  if (noData) return <span className="badge-muted">N/A</span>;
  if (isMarket) return <span className="badge-primary">100%</span>;
  const color = pct >= MARKET_SHARE_THRESHOLD
    ? 'badge-success'
    : 'badge-warning';
  return <span className={color}>{pct.toFixed(2)}%</span>;
}

function fmt(n: number) { return n.toLocaleString(); }

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="table-th">
    {children}
  </th>
);

const TD = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`table-td ${className}`}>{children}</td>
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
    <div className="table-wrap">
      <table className="w-full text-left">
        <thead className="table-head">
          <tr>
            <TH>Broker</TH>
            <TH>Exec Reports</TH>
            <TH>Total Trade</TH>
            <TH>Buy Trade</TH>
            <TH>Sell Trade</TH>
            <TH>Total Value</TH>
            <TH>Buy Value</TH>
            <TH>Sell Value</TH>
            <TH>Value Share %</TH>
            <TH>Trade Share %</TH>
          </tr>
        </thead>
        <tbody className="table-body">
          {showBrokerRows && brokerRows.map(row => (
            <tr key={row.brokerId} className={row.fetchError ? 'bg-[var(--color-row-error)]' : 'table-row'}>
              <TD className="font-medium">
                {row.label}
                {row.fetchError && (
                  <span className="badge-error ml-2">Error</span>
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
          <tr className="bg-[var(--color-row-summary)] font-semibold">
            <TD className="font-bold text-[var(--color-primary)]">XFL Total</TD>
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
          <tr className="bg-[var(--color-row-alt)] border-t-2 border-[var(--color-border-strong)]">
            <TD className="font-bold text-[var(--color-text-secondary)]">{marketLabel}</TD>
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
