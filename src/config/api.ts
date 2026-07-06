// Empty string = Vite proxy handles routing in dev.
// In production, requests to /api/internal/* are proxied to the FastAPI backend.

export const BASE_URL = "";

export const ENDPOINTS = {
  internalBrokerData:  '/api/internal/broker-data',
  internalMarketData:  '/api/internal/market-data',
  internalTokenStatus: '/api/internal/token-status',

  trend: '/api/dashboard/trend',

  login:          '/auth/login',
  refresh:        '/auth/refresh',
  logout:         '/auth/logout',
  changePassword: '/auth/change-password',
  me:             '/auth/me',

  adminBrokers:      '/admin/brokers/',
  adminUsers:        '/admin/users/',
  adminOmsEndpoints: '/admin/oms-endpoints/',
};

export const adminBrokerById = (brokerId: string) => `/admin/brokers/${brokerId}`;
export const adminUserById = (id: number) => `/admin/users/${id}`;
export const adminOmsEndpointByName = (name: string) => `/admin/oms-endpoints/${name}`;

// Share % cells: green if >= threshold, amber if below
export const MARKET_SHARE_THRESHOLD = 5;

// marketRow.values is reported in millions (BDT) while broker totalValue is
// in raw taka — multiply market value by this to compare them directly.
export const MARKET_VALUE_UNIT_MULTIPLIER = 1_000_000;
