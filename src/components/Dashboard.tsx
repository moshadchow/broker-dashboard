import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTrendData } from '../hooks/useTrendData';
import { useAuth } from '../context/AuthContext';
import FilterBar from './FilterBar';
import ComparisonTable from './ComparisonTable';
import TrendChart from './TrendChart';
import ThemeToggle from './ThemeToggle';
import type { DashboardParams } from '../types';

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [params, setParams] = useState<DashboardParams>({
    fromDate:      todayISO(),
    toDate:        todayISO(),
    stockExchange: 'DSE',
  });
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Only pass params to hook after first fetch
  const activeParams = useMemo(
    () => fetchTrigger > 0 ? params : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchTrigger],
  );

  const { brokerRows, aggregateRow, marketRow, loading, error } =
    useDashboardData(activeParams ?? params);
  const { trend } = useTrendData(activeParams);

  const hasData = fetchTrigger > 0 && !loading;
  const allFailed = hasData && brokerRows.every(r => r.fetchError);
  const marketMissing = error?.includes('Market data');
  const showBrokerRows = trend?.trades.ownBroker !== undefined;

  return (
    <div className="app-page">
      {/* Header */}
      <header className="app-header">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Broker Execution <span className="text-[var(--color-primary)]">vs</span> Market Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            UAT · {params.stockExchange} · {params.fromDate} → {params.toDate}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <span className="header-chip">
            Auto-Auth Pipeline
          </span>
          <span className="header-chip">
            {user?.email}
          </span>
          <Link
            to="/profile"
            className="header-action"
          >
            Profile
          </Link>
          <button
            onClick={() => logout()}
            className="header-action"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <FilterBar
          params={params}
          onChange={setParams}
          onFetch={() => setFetchTrigger(t => t + 1)}
          loading={loading}
        />

        {/* Banners */}
        {marketMissing && (
          <div className="alert-warning">
            ⚠️ {error}
          </div>
        )}
        {allFailed && (
          <div className="alert-error flex items-center justify-between">
            <span>❌ All broker fetches failed. Check your session and network.</span>
            <button
              onClick={() => setFetchTrigger(t => t + 1)}
              className="ml-4 px-3 py-1 bg-[var(--color-error)] text-white rounded text-xs font-semibold hover:bg-[var(--color-error-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-48 bg-[var(--color-surface-muted)] rounded-xl animate-pulse" />
            <div className="h-80 bg-[var(--color-surface-muted)] rounded-xl animate-pulse" />
          </div>
        )}

        {/* Data */}
        {hasData && !loading && (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Trading Summary as of {formatDisplayDate(params.toDate)}
              </h2>
              <ComparisonTable
                brokerRows={brokerRows}
                aggregateRow={aggregateRow}
                marketRow={marketRow}
                stockExchange={activeParams?.stockExchange ?? params.stockExchange}
                showBrokerRows={showBrokerRows}
              />
            </section>
            {trend && <TrendChart trend={trend} />}
          </>
        )}

        {/* Empty state */}
        {fetchTrigger === 0 && (
          <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
            Set filters above and click <strong className="text-[var(--color-text-primary)]">Fetch Data</strong> to load.
          </div>
        )}
      </main>
    </div>
  );
}
