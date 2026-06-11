import { ENDPOINTS } from '../config/api';
import { httpClient } from './httpClient';
import type {
  BrokerDataResponse,
  MarketDataResponse,
  TrendResponse,
  DashboardParams,
} from '../types';

export async function fetchInternalBrokerData(toDate: string): Promise<BrokerDataResponse> {
  const res = await httpClient.get<BrokerDataResponse>(ENDPOINTS.internalBrokerData, {
    params: { toDate },
  });
  return res.data;
}

export async function fetchInternalMarketData(toDate: string): Promise<MarketDataResponse> {
  const res = await httpClient.get<MarketDataResponse>(ENDPOINTS.internalMarketData, {
    params: { toDate },
  });
  return res.data;
}

export async function fetchTrendData(params: DashboardParams): Promise<TrendResponse> {
  const res = await httpClient.get<TrendResponse>(ENDPOINTS.trend, { params });
  return res.data;
}
