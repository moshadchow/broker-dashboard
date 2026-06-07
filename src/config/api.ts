// Empty string = Vite proxy handles routing in dev.
// For production build set to: "https://prod-oms-api-1.xfltrade.com:20121"

export const BASE_URL = "";

export const ENDPOINTS = {
  login:        '/api/login',
  refreshToken: '/api/login/refresh-token',

  brokerSummary: (fromDate: string, toDate: string): string =>
    `/api/broker-summary/orders-execution?fromDate=${fromDate}&toDate=${toDate}`,

  marketTradeInfo: (stockExchange: string): string =>
    `/api/indexes/${encodeURIComponent(stockExchange)}/market-trade-info`,
};

// Share % cells: green if >= threshold, amber if below
export const MARKET_SHARE_THRESHOLD = 5;

// appType expected by /api/login
export const APP_TYPE = 1;

// Proactively refresh the access token this many ms before it expires
export const TOKEN_REFRESH_SKEW_MS = 60_000;
