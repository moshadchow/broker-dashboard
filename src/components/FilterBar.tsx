import type { DashboardParams } from '../types';

interface FilterBarProps {
  params:   DashboardParams;
  onChange: (p: DashboardParams) => void;
  onFetch:  () => void;
  loading:  boolean;
}

const EXCHANGES = ['DSE', 'CSE'];

export default function FilterBar({ params, onChange, onFetch, loading }: FilterBarProps) {
  const set = (key: keyof DashboardParams) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...params, [key]: e.target.value });

  return (
    <div className="panel flex flex-wrap items-end gap-4 px-6 py-4">
      <div className="flex flex-col gap-1">
        <label className="field-label">From Date</label>
        <input
          type="date"
          value={params.fromDate}
          onChange={set('fromDate')}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="field-label">To Date</label>
        <input
          type="date"
          value={params.toDate}
          onChange={set('toDate')}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="field-label">Stock Exchange</label>
        <select
          value={params.stockExchange}
          onChange={set('stockExchange')}
          className="field w-32"
        >
          {EXCHANGES.map(exchange => (
            <option key={exchange} value={exchange}>
              {exchange}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onFetch}
        disabled={loading}
        className="button-primary ml-auto"
      >
        {loading ? 'Fetching…' : 'Fetch Data'}
      </button>
    </div>
  );
}
