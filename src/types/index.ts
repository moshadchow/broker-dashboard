// Internal backend API response — broker snapshots
export interface BrokerRowApi {
  brokerId:             string;
  label:                string;
  fetchError:           boolean;
  totalExecutionReport: number;
  totalTrade:           number;
  buyTrade:             number;
  sellTrade:            number;
  totalValue:           number;
  buyValue:             number;
  sellValue:            number;
}

export interface BrokerDataResponse {
  success:   boolean;
  fromDate:  string;
  toDate:    string;
  fetchedAt: string | null;
  brokers:   BrokerRowApi[];
}

// Internal backend API response — market snapshot
export interface MarketDataResponse {
  success:       boolean;
  stockExchange: string;
  fetchedAt:     string | null;
  market:        MarketRow | null;
}

// Domain types
export interface BrokerData {
  totalExecutionReport: number;
  totalTrade:           number;
  buyTrade:             number;
  sellTrade:            number;
  totalValue:           number;
  buyValue:             number;
  sellValue:            number;
}

export interface BrokerRow extends BrokerData {
  brokerId:      string;
  label:         string;
  fetchError:    boolean;
  tradeSharePct: number;
  valueSharePct: number;
}

export interface AggregateRow extends BrokerData {
  tradeSharePct: number;
  valueSharePct: number;
}

export interface MarketRow {
  date:      string;
  low:       number;
  volume:    number;
  trade:     number;
  value:     number;
  gainer:    number;
  loser:     number;
  unchanged: number;
}

export interface DashboardParams {
  fromDate:      string;
  toDate:        string;
  stockExchange: string;
}

export interface DashboardData {
  brokerRows:   BrokerRow[];
  aggregateRow: AggregateRow;
  marketRow:    MarketRow | null;
  loading:      boolean;
  error:        string | null;
}
