import type { ThemeMode } from '../context/ThemeContext';

export interface ChartTheme {
  surface: string;
  plotBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  grid: string;
  axis: string;
  axisLine: string;
  crosshair: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipShadow: string;
  brush: string;
  brushBg: string;
  own: string;
  xfl: string;
  market: string;
  percent: string;
  neutral: string;
}

const FALLBACKS: ChartTheme = {
  surface:       '#ffffff',
  plotBg:        '#ffffff',
  textPrimary:   '#111827',
  textSecondary: '#475569',
  textMuted:     '#64748b',
  border:        '#cbd5e1',
  grid:          '#e5e7eb',
  axis:          '#64748b',
  axisLine:      '#cbd5e1',
  crosshair:     '#94a3b8',
  tooltipBg:     '#ffffff',
  tooltipBorder: '#cbd5e1',
  tooltipShadow: '0 18px 45px rgba(15, 23, 42, 0.16)',
  brush:         '#94a3b8',
  brushBg:       '#f8fafc',
  own:           '#d97706',
  xfl:           '#2563eb',
  market:        '#059669',
  percent:       '#4f46e5',
  neutral:       '#64748b',
};

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getChartTheme(_theme: ThemeMode): ChartTheme {
  return {
    surface:       cssVar('--color-surface', FALLBACKS.surface),
    plotBg:        cssVar('--color-chart-plot-bg', FALLBACKS.plotBg),
    textPrimary:   cssVar('--color-text-primary', FALLBACKS.textPrimary),
    textSecondary: cssVar('--color-text-secondary', FALLBACKS.textSecondary),
    textMuted:     cssVar('--color-text-muted', FALLBACKS.textMuted),
    border:        cssVar('--color-border', FALLBACKS.border),
    grid:          cssVar('--color-chart-grid', FALLBACKS.grid),
    axis:          cssVar('--color-chart-axis', FALLBACKS.axis),
    axisLine:      cssVar('--color-chart-axis-line', FALLBACKS.axisLine),
    crosshair:     cssVar('--color-chart-crosshair', FALLBACKS.crosshair),
    tooltipBg:     cssVar('--color-chart-tooltip-bg', FALLBACKS.tooltipBg),
    tooltipBorder: cssVar('--color-chart-tooltip-border', FALLBACKS.tooltipBorder),
    tooltipShadow: cssVar('--color-chart-tooltip-shadow', FALLBACKS.tooltipShadow),
    brush:         cssVar('--color-chart-brush', FALLBACKS.brush),
    brushBg:       cssVar('--color-chart-brush-bg', FALLBACKS.brushBg),
    own:           cssVar('--color-chart-own', FALLBACKS.own),
    xfl:           cssVar('--color-chart-xfl', FALLBACKS.xfl),
    market:        cssVar('--color-chart-market', FALLBACKS.market),
    percent:       cssVar('--color-chart-percent', FALLBACKS.percent),
    neutral:       cssVar('--color-chart-neutral', FALLBACKS.neutral),
  };
}
