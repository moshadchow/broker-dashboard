import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import FilterBar from './FilterBar';
import ComparisonTable from './ComparisonTable';
import ComparisonChart from './ComparisonChart';
import type { DashboardParams } from '../types';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
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

  const hasData = fetchTrigger > 0 && !loading;
  const allFailed = hasData && brokerRows.every(r => r.fetchError);
  const marketMissing = error?.includes('Market data');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white px-6 py-4 shadow flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Broker Execution <span className="text-blue-400">vs</span> Market Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            UAT · {params.stockExchange} · {params.fromDate} → {params.toDate}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user && <span className="text-gray-300">{user.displayName || user.email}</span>}
          <button
            onClick={logout}
            className="px-3 py-1.5 bg-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-600"
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            ⚠️ {error}
          </div>
        )}
        {allFailed && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 flex items-center justify-between">
            <span>❌ All broker fetches failed. Check your session and network.</span>
            <button
              onClick={() => setFetchTrigger(t => t + 1)}
              className="ml-4 px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        )}

        {/* Data */}
        {hasData && !loading && (
          <>
            <ComparisonTable
              brokerRows={brokerRows}
              aggregateRow={aggregateRow}
              marketRow={marketRow}
            />
            <ComparisonChart
              brokerRows={brokerRows}
              aggregateRow={aggregateRow}
              marketRow={marketRow}
            />
          </>
        )}

        {/* Empty state */}
        {fetchTrigger === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Set filters above and click <strong className="text-gray-600">Fetch Data</strong> to load.
          </div>
        )}
      </main>
    </div>
  );
}
