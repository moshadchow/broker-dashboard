import { useState, useEffect } from 'react';
import { fetchTrendData } from '../services/apiService';
import type { DashboardParams, TrendResponse } from '../types';

interface TrendData {
  trend:   TrendResponse | null;
  loading: boolean;
  error:   string | null;
}

export function useTrendData(params: DashboardParams | null): TrendData {
  const [state, setState] = useState<TrendData>({
    trend:   null,
    loading: false,
    error:   null,
  });

  useEffect(() => {
    if (!params) return;

    let cancelled = false;

    async function load() {
      setState(s => ({ ...s, loading: true, error: null }));

      const resp = await fetchTrendData(params!).catch(() => null);

      if (cancelled) return;

      if (resp?.success) {
        setState({ trend: resp, loading: false, error: null });
      } else {
        setState({ trend: null, loading: false, error: 'Trend data unavailable.' });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [params]);

  return state;
}
