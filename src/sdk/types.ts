/**
 * Questrade API TypeScript SDK - Type Definitions
 * Based on official Questrade API documentation:
 * https://www.questrade.com/api/documentation/getting-started
 */

// ==========================================
// Authentication & Client Config Types
// ==========================================

export interface QuestradeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  api_server: string;
}

export interface QuestradeCredentials {
  accessToken: string;
  apiServer: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number; // Epoch timestamp in ms
}

export interface QuestradeClientOptions {
  /** Questrade Refresh Token or predefined Access Token configuration */
  refreshToken?: string;
  accessToken?: string;
  apiServer?: string;
  /** Auto-refresh token when expiring (default: true) */
  autoRefresh?: boolean;
  /** Custom refresh callback when a new token is generated */
  onTokenRefresh?: (credentials: QuestradeCredentials) => void | Promise<void>;
  /** Max retries for transient HTTP errors / rate limits (default: 3) */
  maxRetries?: number;
  /** Timeout in milliseconds for REST requests (default: 15000) */
  timeoutMs?: number;
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
  /** Custom proxy URL if accessing through a proxy server (e.g. to bypass CORS) */
  proxyUrl?: string;
}

export interface QuestradeOAuthOptions {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

// ==========================================
// Account & Portfolio Types
// ==========================================

export type AccountType =
  | 'Margin'
  | 'Cash'
  | 'TFSA'
  | 'RRSP'
  | 'FHSA'
  | 'RESP'
  | 'LIRA'
  | 'RIF'
  | 'LIF'
  | 'Corporate';

export type AccountStatus = 'Active' | 'Suspended' | 'Closed';

export type ClientAccountType = 'Individual' | 'Joint' | 'Corporate' | 'Trust';

export interface Account {
  type: AccountType;
  number: string;
  status: AccountStatus;
  isPrimary: boolean;
  isBilling: boolean;
  clientAccountType: ClientAccountType;
}

export interface AccountsResponse {
  accounts: Account[];
  userId: number;
}

export interface Position {
  symbol: string;
  symbolId: number;
  openQuantity: number;
  closedQuantity: number;
  currentMarketValue: number;
  currentPrice: number;
  averageEntryPrice: number;
  closedPnl: number;
  openPnl: number;
  totalCost: number;
  isRealTime: boolean;
  isUnderReorg: boolean;
}

export interface PositionsResponse {
  positions: Position[];
}

export interface CurrencyBalance {
  currency: 'CAD' | 'USD';
  cash: number;
  marketValue: number;
  totalEquity: number;
  buyingPower: number;
  maintenanceExcess: number;
  isRealTime: boolean;
}

export interface AccountBalance {
  perCurrencyBalances: CurrencyBalance[];
  combinedBalances: CurrencyBalance[];
  sodPerCurrencyBalances: CurrencyBalance[];
  sodCombinedBalances: CurrencyBalance[];
}

export interface Execution {
  symbol: string;
  symbolId: number;
  id: number;
  sequenceNumber: number;
  orderId: number;
  orderPlacementCommission: number;
  tradeId: number;
  side: 'Buy' | 'Sell';
  price: number;
  notes: string;
  venue: string;
  totalCost: number;
  orderRoute: string;
  executingBroker: string;
  commission: number;
  executionTime: string; // ISO format
}

export interface ExecutionsResponse {
  executions: Execution[];
}

export type OrderAction = 'Buy' | 'Sell';
export type OrderSide = 'Buy' | 'Sell';
export type OrderType = 'Market' | 'Limit' | 'Stop' | 'StopLimit' | 'TrailStopInPercentage' | 'TrailStopInDollar';
export type OrderTimeInForce = 'Day' | 'GoodTillCancelled' | 'GoodTillDate' | 'ImmediateOrCancel' | 'FillOrKill';
export type OrderState = 'Submitted' | 'Accepted' | 'Triggered' | 'Queued' | 'Executed' | 'Canceled' | 'Rejected' | 'Expired' | 'Partial';

export interface Order {
  id: number;
  symbol: string;
  symbolId: number;
  totalQuantity: number;
  openQuantity: number;
  filledQuantity: number;
  canceledQuantity: number;
  side: OrderSide;
  orderType: OrderType;
  limitPrice?: number | null;
  stopPrice?: number | null;
  isAllOrNone: boolean;
  isAnonymous: boolean;
  icebergQuantity?: number | null;
  minQuantity?: number | null;
  avgExecPrice?: number | null;
  lastExecPrice?: number | null;
  source: string;
  timeInForce: OrderTimeInForce;
  gtdDate?: string | null;
  state: OrderState;
  rejectionReason?: string;
  chainId: number;
  creationTime: string;
  updateTime: string;
  notes: string;
  primaryRoute: string;
  secondaryRoute: string;
  orderRoute: string;
  venueHoldingOrder: string;
  comissionCharged: number;
  exchangeOrderId: string;
  isSignificantShareHolder: boolean;
  isInsider: boolean;
  isLimitOffsetInDollar: boolean;
  userId: number;
  placementCommission?: number;
  legs: OrderLeg[];
  strategyType: string;
}

export interface OrderLeg {
  legId: number;
  symbol: string;
  symbolId: number;
  legRatioQuantity: number;
  side: OrderSide;
  avgExecPrice?: number | null;
  lastExecPrice?: number | null;
}

export interface OrdersResponse {
  orders: Order[];
}

export interface OrderImpactRequest {
  symbolId: number;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  isAllOrNone?: boolean;
  isAnonymous?: boolean;
  orderType: OrderType;
  timeInForce: OrderTimeInForce;
  action: OrderAction;
  primaryRoute?: string;
  secondaryRoute?: string;
}

export interface OrderImpact {
  buyingPowerEffect: number;
  buyingPowerResult: number;
  maintExcessEffect: number;
  maintExcessResult: number;
  tradeValue: number;
  price: number;
  commission: number;
  estimatedCommission: number;
}

export interface OrderPlacementRequest {
  symbolId: number;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  isAllOrNone?: boolean;
  isAnonymous?: boolean;
  orderType: OrderType;
  timeInForce: OrderTimeInForce;
  action: OrderAction;
  primaryRoute?: string;
  secondaryRoute?: string;
}

export interface OrderPlacementResponse {
  orderId: number;
  orders: Order[];
}

export interface OrderModificationRequest {
  quantity?: number;
  limitPrice?: number;
  stopPrice?: number;
  orderType?: OrderType;
  timeInForce?: OrderTimeInForce;
}

export interface MarketInfo {
  name: string;
  tradingVenues: string[];
  defaultTradingVenue: string;
  primaryOrderRoutes: string[];
  secondaryOrderRoutes: string[];
  level1Feeds: string[];
  level2Feeds: string[];
}

export interface MarketsResponse {
  markets: MarketInfo[];
}

export interface OptionQuotesFilter {
  underlyingId: number;
  expiryDate?: string;
  minstrikePrice?: number;
  maxstrikePrice?: number;
}

export interface OptionQuotesResponse {
  optionQuotes: Level1Quote[];
}

export interface Activity {
  tradeDate: string;
  transactionDate: string;
  settlementDate: string;
  action: string;
  symbol: string;
  symbolId: number;
  description: string;
  currency: 'CAD' | 'USD';
  quantity: number;
  price: number;
  grossAmount: number;
  commission: number;
  netAmount: number;
  type: string;
}

export interface ActivitiesResponse {
  activities: Activity[];
}

// ==========================================
// Symbols, Search & Metadata Types
// ==========================================

export type SecurityType = 'Stock' | 'Option' | 'Bond' | 'Right' | 'MutualFund' | 'Index';
export type OptionType = 'Call' | 'Put';
export type OptionDurationType = 'Weekly' | 'Monthly' | 'Quarterly' | 'LEAP';
export type OptionExerciseType = 'American' | 'European';

export interface SymbolInfo {
  symbol: string;
  symbolId: number;
  description: string;
  securityType: SecurityType;
  listingExchange: string;
  isTradable: boolean;
  isQuotable: boolean;
  currency: 'CAD' | 'USD';
  minTick: number;
  industrySector?: string;
  industryGroup?: string;
  industrySubGroup?: string;
  prevDayClosePrice?: number;
  highPrice52?: number;
  lowPrice52?: number;
  averageVol3Months?: number;
  averageVol20Days?: number;
  outstandingShares?: number;
  eps?: number;
  pe?: number;
  dividend?: number;
  yield?: number;
  optionType?: OptionType;
  optionDurationType?: OptionDurationType;
  optionRoot?: string;
  optionContractDeliverables?: {
    underlyingSymbol: string;
    underlyingSymbolId: number;
    shares: number;
    cashReceipts: number;
  };
  optionExerciseType?: OptionExerciseType;
  optionExpiryDate?: string;
  optionStrikePrice?: number;
}

export interface SymbolSearchResult {
  symbol: string;
  symbolId: number;
  description: string;
  securityType: SecurityType;
  listingExchange: string;
  isTradable: boolean;
  isQuotable: boolean;
  currency: 'CAD' | 'USD';
}

export interface SymbolsSearchResponse {
  symbols: SymbolSearchResult[];
}

export interface SymbolsResponse {
  symbols: SymbolInfo[];
}

export interface OptionChainChainNode {
  expiryDate: string;
  description: string;
  listingExchange: string;
  optionExerciseType: OptionExerciseType;
  chainPerRoot: {
    root: string;
    strikePrices: number[];
    multiplier: number;
  }[];
}

export interface OptionChainResponse {
  optionChain: OptionChainChainNode[];
}

// ==========================================
// Market Data & Quotes Types
// ==========================================

export interface Level1Quote {
  symbol: string;
  symbolId: number;
  tier?: string;
  bidPrice: number | null;
  bidSize: number | null;
  askPrice: number | null;
  askSize: number | null;
  lastTradePriceTraded: number | null;
  lastTradeSize: number | null;
  lastTradeTick?: 'Up' | 'Down' | 'Equal';
  lastTradeTime: string;
  volume: number;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  delay: number; // in seconds (0 = real-time)
  isHalted: boolean;
  vwap?: number | null;
}

export interface QuotesResponse {
  quotes: Level1Quote[];
}

export type HistoricalCandleInterval =
  | 'OneMinute'
  | 'TwoMinutes'
  | 'ThreeMinutes'
  | 'FourMinutes'
  | 'FiveMinutes'
  | 'TenMinutes'
  | 'FifteenMinutes'
  | 'TwentyMinutes'
  | 'HalfHour'
  | 'OneHour'
  | 'TwoHours'
  | 'FourHours'
  | 'OneDay'
  | 'OneWeek'
  | 'OneMonth'
  | 'OneYear';

export interface Candle {
  start: string; // ISO 8601
  end: string;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
  VWAP: number;
}

export interface CandlesResponse {
  candles: Candle[];
}

export interface HistoricalCandlesOptions {
  startTime: string | Date;
  endTime?: string | Date;
  interval?: HistoricalCandleInterval;
}

export interface StreamPortResponse {
  streamPort: number;
}

// ==========================================
// Streaming & Polling Types
// ==========================================

export interface StreamQuoteMessage {
  quotes?: Level1Quote[];
  error?: string;
  type?: 'quote' | 'heartbeat' | 'handshake';
}

export interface OrderNotificationMessage {
  orders?: Order[];
  executions?: Execution[];
  type?: 'order' | 'execution' | 'heartbeat';
}

export interface StreamOptions {
  /** Reconnect automatically on disconnect */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelayMs?: number;
  /** Heartbeat timeout interval in ms (default: 30000) */
  heartbeatIntervalMs?: number;
  /** Custom WebSocket constructor (Node or browser) */
  webSocketImpl?: any;
}

export interface PollFeedOptions {
  /** Polling interval in ms (default: 1000) */
  intervalMs?: number;
  /** Maximum symbols per batch query (Questrade max: 100, default: 50) */
  batchSize?: number;
  /** Only fire quote event if price/bid/ask/volume changed (default: true) */
  deduplicate?: boolean;
  /** Adaptive polling slows down when market is closed or on error (default: true) */
  adaptive?: boolean;
}

export interface MarketFeedOptions {
  mode?: 'stream' | 'poll' | 'auto';
  streamOptions?: StreamOptions;
  pollOptions?: PollFeedOptions;
}

export interface FeedStats {
  mode: 'stream' | 'poll' | 'idle';
  subscribedCount: number;
  totalTicksReceived: number;
  ticksPerSecond: number;
  lastTickTimestamp: number | null;
  connectionState: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';
  latencyMs: number;
  errorCount: number;
  lastError?: string;
}

export type FeedEventListener<T> = (data: T) => void;
