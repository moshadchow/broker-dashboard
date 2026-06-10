import { ENDPOINTS } from '../config/api';
import { httpClient } from './httpClient';
import type {
  BrokerDataResponse,
  MarketDataResponse,
} from '../types';

export async function fetchInternalBrokerData(): Promise<BrokerDataResponse> {
  const res = await httpClient.get<BrokerDataResponse>(ENDPOINTS.internalBrokerData);
  return res.data;
}

export async function fetchInternalMarketData(): Promise<MarketDataResponse> {
  const res = await httpClient.get<MarketDataResponse>(ENDPOINTS.internalMarketData);
  return res.data;
}
