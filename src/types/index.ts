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

export interface BrokerAggregateApi {
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
  aggregate: BrokerAggregateApi;
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
  snapshotDate:       string;
  times:              number;
  closes:             number;
  ltps:               number;
  ycps:               number;
  opens:              number;
  highs:              number;
  lows:               number;
  settlementPrices:   number;
  volumes:            number;
  trades:             number;
  values:             number;
  changes:            number;
  changePercentages:  number;
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

// Internal backend API response — trend chart
export interface TrendSeries {
  ownBroker?:   number[];
  xfl:          number[];
  market:       number[];
  pctOfXfl?:    number[];
  pctOfMarket:  number[];
}

export interface TrendResponse {
  success:         boolean;
  dates:           string[];
  trades:          TrendSeries;
  value:           TrendSeries;
  ownBrokerLabel?: string;
}
