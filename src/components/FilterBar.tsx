import type { DashboardParams } from '../types';

interface FilterBarProps {
  params:   DashboardParams;
  onChange: (p: DashboardParams) => void;
  onFetch:  () => void;
  loading:  boolean;
}

export default function FilterBar({ params, onChange, onFetch, loading }: FilterBarProps) {
  const set = (key: keyof DashboardParams) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...params, [key]: e.target.value });

  return (
    <div className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From Date</label>
        <input
          type="date"
          value={params.fromDate}
          onChange={set('fromDate')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To Date</label>
        <input
          type="date"
          value={params.toDate}
          onChange={set('toDate')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock Exchange</label>
        <input
          type="text"
          value={params.stockExchange}
          onChange={set('stockExchange')}
          placeholder="e.g. DSE"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={onFetch}
        disabled={loading}
        className="ml-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading ? 'Fetching…' : 'Fetch Data'}
      </button>
    </div>
  );
}
