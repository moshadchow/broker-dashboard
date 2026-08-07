# /project:service

Create `src/services/apiService.ts`.

## Rules
- Endpoint 1 headers: `X-BrokerId` + `Authorization: Bearer`
- Endpoint 2 headers: `Authorization: Bearer` ONLY — no `X-BrokerId`
- JWT read from `import.meta.env.VITE_JWT_TOKEN`
- Throw if HTTP error OR `response.data.success === false`

## File: `src/services/apiService.ts`

```ts
import axios from 'axios';
import { BASE_URL, ENDPOINTS } from '../config/api';
import type {
  BrokerSummaryApiResponse,
  MarketTradeInfoApiResponse,
} from '../types';

const token = import.meta.env.VITE_JWT_TOKEN as string;

export async function fetchBrokerSummary(
  brokerId: string,
  fromDate: string,
  toDate: string,
): Promise<BrokerSummaryApiResponse> {
  const res = await axios.get<BrokerSummaryApiResponse>(
    `${BASE_URL}${ENDPOINTS.brokerSummary(fromDate, toDate)}`,
    {
      headers: {
        'X-BrokerId':    brokerId,
        'Authorization': `Bearer ${token}`,
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
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        // No X-BrokerId on this endpoint
      },
    },
  );
  if (!res.data.success) {
    throw new Error(`Market trade info: success=false`);
  }
  return res.data;
}
```
