import type { ThemeMode } from '../context/ThemeContext';

export interface ChartTheme {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  brush: string;
  own: string;
  xfl: string;
  market: string;
  percent: string;
}

const FALLBACKS: ChartTheme = {
  surface:       '#ffffff',
  textPrimary:   '#111827',
  textSecondary: '#475569',
  border:        '#cbd5e1',
  grid:          '#e5e7eb',
  axis:          '#64748b',
  tooltipBg:     '#ffffff',
  tooltipBorder: '#cbd5e1',
  brush:         '#94a3b8',
  own:           '#d97706',
  xfl:           '#2563eb',
  market:        '#059669',
  percent:       '#4f46e5',
};

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getChartTheme(_theme: ThemeMode): ChartTheme {
  return {
    surface:       cssVar('--color-surface', FALLBACKS.surface),
    textPrimary:   cssVar('--color-text-primary', FALLBACKS.textPrimary),
    textSecondary: cssVar('--color-text-secondary', FALLBACKS.textSecondary),
    border:        cssVar('--color-border', FALLBACKS.border),
    grid:          cssVar('--color-chart-grid', FALLBACKS.grid),
    axis:          cssVar('--color-chart-axis', FALLBACKS.axis),
    tooltipBg:     cssVar('--color-chart-tooltip-bg', FALLBACKS.tooltipBg),
    tooltipBorder: cssVar('--color-chart-tooltip-border', FALLBACKS.tooltipBorder),
    brush:         cssVar('--color-chart-brush', FALLBACKS.brush),
    own:           cssVar('--color-chart-own', FALLBACKS.own),
    xfl:           cssVar('--color-chart-xfl', FALLBACKS.xfl),
    market:        cssVar('--color-chart-market', FALLBACKS.market),
    percent:       cssVar('--color-chart-percent', FALLBACKS.percent),
  };
}
