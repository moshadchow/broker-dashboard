import axios from 'axios';
import { BASE_URL, ENDPOINTS } from '../config/api';
import type {
  BrokerSummaryApiResponse,
  MarketTradeInfoApiResponse,
} from '../types';

// Authorization header is attached by the auth request interceptor (see authInterceptor.ts)

export async function fetchBrokerSummary(
  brokerId: string,
  fromDate: string,
  toDate: string,
): Promise<BrokerSummaryApiResponse> {
  const res = await axios.get<BrokerSummaryApiResponse>(
    `${BASE_URL}${ENDPOINTS.brokerSummary(fromDate, toDate)}`,
    {
      headers: {
        'X-BrokerId': brokerId,
      },
    },
  );
  if (!res.data.success) {
    throw new Error(`Broker ${brokerId}: success=false`);
  }
  return res.data;
}

export async function fetchMarketTradeInfo(
  stockExchange: string,
): Promise<MarketTradeInfoApiResponse> {
  const res = await axios.get<MarketTradeInfoApiResponse>(
    `${BASE_URL}${ENDPOINTS.marketTradeInfo(stockExchange)}`,
    // No X-BrokerId on this endpoint; Authorization attached by interceptor
  );
  if (!res.data.success) {
    throw new Error(`Market trade info: success=false`);
  }
  return res.data;
}
