import axios from 'axios';
import { BASE_URL, ENDPOINTS } from '../config/api';
import type {
  BrokerDataResponse,
  MarketDataResponse,
} from '../types';

export async function fetchInternalBrokerData(): Promise<BrokerDataResponse> {
  const res = await axios.get<BrokerDataResponse>(`${BASE_URL}${ENDPOINTS.internalBrokerData}`);
  return res.data;
}

export async function fetchInternalMarketData(): Promise<MarketDataResponse> {
  const res = await axios.get<MarketDataResponse>(`${BASE_URL}${ENDPOINTS.internalMarketData}`);
  return res.data;
}
