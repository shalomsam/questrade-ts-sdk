/**
 * Questrade API TypeScript SDK - Core REST Client
 * Robust, lightweight, zero-dependency client with automatic auth management,
 * rate limit handling, and end-to-end typed methods.
 */

import {
  Account,
  AccountBalance,
  AccountsResponse,
  Activity,
  ActivitiesResponse,
  Candle,
  CandlesResponse,
  Execution,
  ExecutionsResponse,
  HistoricalCandlesOptions,
  Level1Quote,
  MarketInfo,
  MarketsResponse,
  OptionChainChainNode,
  OptionChainResponse,
  OptionQuotesFilter,
  OptionQuotesResponse,
  Order,
  OrderImpact,
  OrderImpactRequest,
  OrderModificationRequest,
  OrderPlacementRequest,
  OrderPlacementResponse,
  OrdersResponse,
  Position,
  PositionsResponse,
  QuestradeClientOptions,
  QuestradeCredentials,
  QuestradeTokenResponse,
  QuotesResponse,
  StreamPortResponse,
  SymbolInfo,
  SymbolSearchResult,
  SymbolsResponse,
  SymbolsSearchResponse,
} from './types';
import {
  QuestradeApiErrorCode,
  QuestradeAuthError,
  QuestradeError,
  QuestradeNotFoundError,
  QuestradeRateLimitError,
  QuestradeValidationError,
} from './errors';

export class QuestradeClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private apiServer: string | null = null;
  private tokenType: string = 'Bearer';
  private expiresAt: number = 0; // Epoch timestamp in ms
  private readonly autoRefresh: boolean;
  private readonly onTokenRefresh?: (credentials: QuestradeCredentials) => void | Promise<void>;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly proxyUrl?: string;
  private readonly sandbox: boolean;

  private refreshPromise: Promise<QuestradeCredentials> | null = null;
  private rateLimitRemaining: number = 60;
  private rateLimitResetTime: number = 0;

  constructor(options: QuestradeClientOptions = {}) {
    this.refreshToken = options.refreshToken || null;
    this.accessToken = options.accessToken || null;
    this.apiServer = options.apiServer ? options.apiServer.replace(/\/+$/, '') : null;
    this.autoRefresh = options.autoRefresh ?? true;
    this.onTokenRefresh = options.onTokenRefresh;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.proxyUrl = options.proxyUrl ? options.proxyUrl.replace(/\/+$/, '') : undefined;
    this.sandbox = options.sandbox ?? false;

    // If access token is provided with no explicit expiry, assume 30 minutes from now
    if (this.accessToken) {
      this.expiresAt = Date.now() + 30 * 60 * 1000;
    }
  }

  /**
   * Check if the current access token is valid and not expired
   */
  public isAuthenticated(): boolean {
    return !!this.accessToken && !!this.apiServer && Date.now() < this.expiresAt - 60000;
  }

  /**
   * Get current credentials snapshot
   */
  public getCredentials(): QuestradeCredentials | null {
    if (!this.accessToken || !this.apiServer) return null;
    return {
      accessToken: this.accessToken,
      apiServer: this.apiServer,
      refreshToken: this.refreshToken || undefined,
      tokenType: this.tokenType,
      expiresAt: this.expiresAt,
    };
  }

  /**
   * Manually update credentials
   */
  public setCredentials(credentials: Partial<QuestradeCredentials>): void {
    if (credentials.accessToken) this.accessToken = credentials.accessToken;
    if (credentials.apiServer) this.apiServer = credentials.apiServer.replace(/\/+$/, '');
    if (credentials.refreshToken) this.refreshToken = credentials.refreshToken;
    if (credentials.tokenType) this.tokenType = credentials.tokenType;
    if (credentials.expiresAt) this.expiresAt = credentials.expiresAt;
    else if (credentials.accessToken) this.expiresAt = Date.now() + 30 * 60 * 1000;
  }

  /**
   * Exchange a manual or refresh token for a live access token and API server URL
   * Official URL: https://login.questrade.com/oauth2/token?grant_type=refresh_token&refresh_token=TOKEN
   */
  public async exchangeRefreshToken(tokenToExchange?: string): Promise<QuestradeCredentials> {
    const targetRefreshToken = tokenToExchange || this.refreshToken;
    if (!targetRefreshToken) {
      throw new QuestradeAuthError('Cannot exchange token: No refresh token provided or stored in client.', {
        code: QuestradeApiErrorCode.INVALID_REFRESH_TOKEN,
        message: 'No refresh token available.',
      });
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const tokenAuthUrl = `https://login.questrade.com/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(
          targetRefreshToken
        )}`;

        const url = this.proxyUrl ? `${this.proxyUrl}?url=${encodeURIComponent(tokenAuthUrl)}` : tokenAuthUrl;

        const response = await this.fetchWithTimeout(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let parsedError: any = {};
          try {
            parsedError = JSON.parse(errorBody);
          } catch {
            // non-json response
          }

          throw new QuestradeAuthError(
            `Token exchange failed with HTTP ${response.status}: ${parsedError.error_description || parsedError.message || errorBody || response.statusText}`,
            {
              status: response.status,
              code: QuestradeApiErrorCode.INVALID_REFRESH_TOKEN,
              message: parsedError.message || errorBody,
              rawResponse: parsedError,
            },
            true
          );
        }

        const data = (await response.json()) as QuestradeTokenResponse;

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.apiServer = data.api_server.replace(/\/+$/, '');
        this.tokenType = data.token_type || 'Bearer';
        this.expiresAt = Date.now() + (data.expires_in || 1800) * 1000;

        const newCredentials: QuestradeCredentials = {
          accessToken: this.accessToken,
          apiServer: this.apiServer,
          refreshToken: this.refreshToken,
          tokenType: this.tokenType,
          expiresAt: this.expiresAt,
        };

        if (this.onTokenRefresh) {
          try {
            await this.onTokenRefresh(newCredentials);
          } catch (err) {
            console.warn('[QuestradeClient] onTokenRefresh callback error:', err);
          }
        }

        return newCredentials;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Internal HTTP request handler with automatic token refresh, rate limit backoff, and diagnostics
   */
  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

    // Auto-refresh token if near expiration (within 2 minutes)
    if (this.autoRefresh && this.refreshToken && Date.now() >= this.expiresAt - 120000) {
      await this.exchangeRefreshToken();
    }

    if (!this.accessToken || !this.apiServer) {
      if (this.refreshToken) {
        await this.exchangeRefreshToken();
      } else {
        throw new QuestradeAuthError('QuestradeClient is not authenticated. Please provide credentials or a refreshToken.', {
          code: QuestradeApiErrorCode.INVALID_ACCESS_TOKEN,
          message: 'Missing accessToken and apiServer.',
          endpoint: cleanEndpoint,
        });
      }
    }

    let targetUrl = `${this.apiServer}/${cleanEndpoint}`;
    if (this.proxyUrl) {
      targetUrl = `${this.proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
    }

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const headers: Record<string, string> = {
          Authorization: `${this.tokenType} ${this.accessToken}`,
          Accept: 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        };

        const response = await this.fetchWithTimeout(targetUrl, {
          ...options,
          headers,
        });

        // Parse rate limit headers if provided by Questrade / Proxy
        const rateLimitRemainingHeader = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemainingHeader) {
          this.rateLimitRemaining = parseInt(rateLimitRemainingHeader, 10);
        }

        if (response.ok) {
          if (response.status === 204) return null as unknown as T;
          return (await response.json()) as T;
        }

        // Handle HTTP Errors
        const errorText = await response.text();
        let errorJson: any = null;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          // not json
        }

        const errorMessage = errorJson?.message || errorText || response.statusText;
        const questradeCode = errorJson?.code || QuestradeApiErrorCode.UNKNOWN;

        // Handle 401 Unauthorized -> Attempt token refresh once
        if (response.status === 401 && this.autoRefresh && this.refreshToken && attempt <= 2) {
          await this.exchangeRefreshToken();
          // Update authorization header and retry immediately
          continue;
        }

        // Handle 429 Rate Limit
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
          if (attempt <= this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
          throw new QuestradeRateLimitError(`Questrade Rate Limit Exceeded (HTTP 429). Retry after ${retryAfter}s`, {
            status: 429,
            code: QuestradeApiErrorCode.RATE_LIMIT_EXCEEDED,
            message: errorMessage,
            endpoint: cleanEndpoint,
            retryAfterSeconds: retryAfter,
            rawResponse: errorJson,
          });
        }

        // Handle 404 Not Found
        if (response.status === 404) {
          throw new QuestradeNotFoundError(`Questrade resource not found at ${cleanEndpoint}: ${errorMessage}`, {
            status: 404,
            code: questradeCode,
            message: errorMessage,
            endpoint: cleanEndpoint,
            rawResponse: errorJson,
          });
        }

        // Other errors
        throw new QuestradeError(`Questrade API error (HTTP ${response.status}): ${errorMessage}`, {
          status: response.status,
          code: questradeCode,
          message: errorMessage,
          endpoint: cleanEndpoint,
          rawResponse: errorJson,
        });
      } catch (err: any) {
        if (err instanceof QuestradeError) {
          throw err;
        }

        // Handle network timeout / connection aborts
        if (attempt <= this.maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        throw new QuestradeError(`Network request failed on ${cleanEndpoint}: ${err.message || err}`, {
          message: err.message || 'Unknown network error',
          endpoint: cleanEndpoint,
        });
      }
    }

    throw new QuestradeError(`Failed to execute request to ${cleanEndpoint} after ${this.maxRetries} attempts.`);
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // ==========================================
  // Questrade API Endpoints Implementation
  // ==========================================

  /**
   * Get server time in ISO-8601 format
   * GET v1/time
   */
  public async getServerTime(): Promise<string> {
    const res = await this.request<{ time: string }>('v1/time');
    return res.time;
  }

  /**
   * Retrieve all trading accounts for the authenticated user
   * GET v1/accounts
   */
  public async getAccounts(): Promise<Account[]> {
    const res = await this.request<AccountsResponse>('v1/accounts');
    return res.accounts || [];
  }

  /**
   * Retrieve positions for a specific account ID
   * GET v1/accounts/:id/positions
   */
  public async getPositions(accountId: string): Promise<Position[]> {
    if (!accountId) throw new QuestradeValidationError('Account ID is required for getPositions');
    const res = await this.request<PositionsResponse>(`v1/accounts/${encodeURIComponent(accountId)}/positions`);
    return res.positions || [];
  }

  /**
   * Retrieve balances for a specific account ID
   * GET v1/accounts/:id/balances
   */
  public async getBalances(accountId: string): Promise<AccountBalance> {
    if (!accountId) throw new QuestradeValidationError('Account ID is required for getBalances');
    return await this.request<AccountBalance>(`v1/accounts/${encodeURIComponent(accountId)}/balances`);
  }

  /**
   * Retrieve executions for a specific account ID
   * GET v1/accounts/:id/executions
   */
  public async getExecutions(
    accountId: string,
    options?: { startTime?: string | Date; endTime?: string | Date }
  ): Promise<Execution[]> {
    if (!accountId) throw new QuestradeValidationError('Account ID is required for getExecutions');
    const query = new URLSearchParams();
    if (options?.startTime) {
      query.set('startTime', options.startTime instanceof Date ? options.startTime.toISOString() : options.startTime);
    }
    if (options?.endTime) {
      query.set('endTime', options.endTime instanceof Date ? options.endTime.toISOString() : options.endTime);
    }
    const qStr = query.toString();
    const endpoint = `v1/accounts/${encodeURIComponent(accountId)}/executions${qStr ? `?${qStr}` : ''}`;
    const res = await this.request<ExecutionsResponse>(endpoint);
    return res.executions || [];
  }

  /**
   * Retrieve orders for a specific account ID
   * GET v1/accounts/:id/orders
   */
  public async getOrders(
    accountId: string,
    options?: {
      ids?: number[];
      stateFilter?: 'All' | 'Open' | 'Closed';
      startTime?: string | Date;
      endTime?: string | Date;
    }
  ): Promise<Order[]> {
    if (!accountId) throw new QuestradeValidationError('Account ID is required for getOrders');
    const query = new URLSearchParams();
    if (options?.ids?.length) query.set('ids', options.ids.join(','));
    if (options?.stateFilter) query.set('stateFilter', options.stateFilter);
    if (options?.startTime) {
      query.set('startTime', options.startTime instanceof Date ? options.startTime.toISOString() : options.startTime);
    }
    if (options?.endTime) {
      query.set('endTime', options.endTime instanceof Date ? options.endTime.toISOString() : options.endTime);
    }
    const qStr = query.toString();
    const endpoint = `v1/accounts/${encodeURIComponent(accountId)}/orders${qStr ? `?${qStr}` : ''}`;
    const res = await this.request<OrdersResponse>(endpoint);
    return res.orders || [];
  }

  /**
   * Retrieve a specific order by ID
   * GET v1/accounts/:accountId/orders/:orderId
   */
  public async getOrder(accountId: string, orderId: number): Promise<Order> {
    if (!accountId || !orderId) throw new QuestradeValidationError('Account ID and Order ID are required');
    const res = await this.request<{ orders: Order[] }>(
      `v1/accounts/${encodeURIComponent(accountId)}/orders/${encodeURIComponent(orderId)}`
    );
    if (!res.orders || res.orders.length === 0) {
      throw new QuestradeNotFoundError(`Order ${orderId} not found in account ${accountId}`);
    }
    return res.orders[0];
  }

  /**
   * Retrieve activities for a specific account ID
   * GET v1/accounts/:id/activities
   */
  public async getActivities(
    accountId: string,
    options?: { startTime?: string | Date; endTime?: string | Date }
  ): Promise<Activity[]> {
    if (!accountId) throw new QuestradeValidationError('Account ID is required for getActivities');
    const query = new URLSearchParams();
    if (options?.startTime) {
      query.set('startTime', options.startTime instanceof Date ? options.startTime.toISOString() : options.startTime);
    }
    if (options?.endTime) {
      query.set('endTime', options.endTime instanceof Date ? options.endTime.toISOString() : options.endTime);
    }
    const qStr = query.toString();
    const endpoint = `v1/accounts/${encodeURIComponent(accountId)}/activities${qStr ? `?${qStr}` : ''}`;
    const res = await this.request<ActivitiesResponse>(endpoint);
    return res.activities || [];
  }

  /**
   * Search for symbols matching a text prefix
   * GET v1/symbols/search?prefix=AAPL&offset=0
   */
  public async searchSymbols(prefix: string, offset: number = 0): Promise<SymbolSearchResult[]> {
    if (!prefix || prefix.trim().length === 0) return [];
    const endpoint = `v1/symbols/search?prefix=${encodeURIComponent(prefix.trim())}&offset=${offset}`;
    const res = await this.request<SymbolsSearchResponse>(endpoint);
    return res.symbols || [];
  }

  /**
   * Retrieve detailed symbol information by symbol IDs
   * GET v1/symbols?ids=8049,9291
   */
  public async getSymbolsByIds(ids: number[]): Promise<SymbolInfo[]> {
    if (!ids || ids.length === 0) return [];
    const endpoint = `v1/symbols?ids=${ids.join(',')}`;
    const res = await this.request<SymbolsResponse>(endpoint);
    return res.symbols || [];
  }

  /**
   * Retrieve detailed symbol information by symbol names
   * GET v1/symbols?names=AAPL,MSFT,SHOP.TO
   */
  public async getSymbolsByNames(names: string[]): Promise<SymbolInfo[]> {
    if (!names || names.length === 0) return [];
    const endpoint = `v1/symbols?names=${encodeURIComponent(names.join(','))}`;
    const res = await this.request<SymbolsResponse>(endpoint);
    return res.symbols || [];
  }

  /**
   * Retrieve detailed symbol info for a single symbol ID
   * GET v1/symbols/:id
   */
  public async getSymbol(id: number): Promise<SymbolInfo> {
    if (!id) throw new QuestradeValidationError('Symbol ID is required for getSymbol');
    const res = await this.request<SymbolsResponse>(`v1/symbols/${encodeURIComponent(id)}`);
    if (!res.symbols || res.symbols.length === 0) {
      throw new QuestradeNotFoundError(`Symbol with ID ${id} was not found.`);
    }
    return res.symbols[0];
  }

  /**
   * Retrieve option chain for a given underlying symbol ID
   * GET v1/symbols/:id/options
   */
  public async getOptionChain(symbolId: number): Promise<OptionChainChainNode[]> {
    if (!symbolId) throw new QuestradeValidationError('Symbol ID is required for getOptionChain');
    const res = await this.request<OptionChainResponse>(`v1/symbols/${encodeURIComponent(symbolId)}/options`);
    return res.optionChain || [];
  }

  /**
   * Retrieve Level 1 snap quotes for symbol IDs (batch up to 100)
   * GET v1/markets/quotes?ids=8049,9291
   */
  public async getQuotes(symbolIds: number[]): Promise<Level1Quote[]> {
    if (!symbolIds || symbolIds.length === 0) return [];
    const endpoint = `v1/markets/quotes?ids=${symbolIds.join(',')}`;
    const res = await this.request<QuotesResponse>(endpoint);
    return res.quotes || [];
  }

  /**
   * Retrieve single Level 1 quote for a symbol ID
   * GET v1/markets/quotes/:id
   */
  public async getQuote(symbolId: number): Promise<Level1Quote> {
    if (!symbolId) throw new QuestradeValidationError('Symbol ID is required for getQuote');
    const res = await this.request<QuotesResponse>(`v1/markets/quotes/${encodeURIComponent(symbolId)}`);
    if (!res.quotes || res.quotes.length === 0) {
      throw new QuestradeNotFoundError(`Quote for symbol ID ${symbolId} was not found.`);
    }
    return res.quotes[0];
  }

  /**
   * Retrieve historical candles (OHLCV) for a symbol
   * GET v1/markets/candles/:id?startTime=...&endTime=...&interval=OneDay
   */
  public async getCandles(symbolId: number, options: HistoricalCandlesOptions): Promise<Candle[]> {
    if (!symbolId) throw new QuestradeValidationError('Symbol ID is required for getCandles');
    if (!options?.startTime) throw new QuestradeValidationError('startTime is required for getCandles');

    const query = new URLSearchParams();
    const startStr = options.startTime instanceof Date ? options.startTime.toISOString() : options.startTime;
    query.set('startTime', startStr);

    if (options.endTime) {
      const endStr = options.endTime instanceof Date ? options.endTime.toISOString() : options.endTime;
      query.set('endTime', endStr);
    }
    query.set('interval', options.interval || 'OneDay');

    const endpoint = `v1/markets/candles/${encodeURIComponent(symbolId)}?${query.toString()}`;
    const res = await this.request<CandlesResponse>(endpoint);
    return res.candles || [];
  }

  /**
   * Request streaming port for WebSocket / RawSocket streaming
   * GET v1/markets/quotes?ids=8049&stream=true&mode=WebSocket
   */
  public async getStreamPort(mode: 'WebSocket' | 'RawSocket' = 'WebSocket', symbolIds: number[] = []): Promise<number> {
    const ids = symbolIds.length ? symbolIds.join(',') : '8049';
    const endpoint = `v1/markets/quotes?ids=${ids}&stream=true&mode=${mode}`;
    const res = await this.request<StreamPortResponse>(endpoint);
    return res.streamPort;
  }

  /**
   * Test an order to calculate buying power, margin impact, and commissions before submission
   * POST v1/accounts/:accountId/orders/impact
   */
  public async testOrder(accountId: string, order: OrderImpactRequest): Promise<OrderImpact> {
    if (!accountId) throw new QuestradeValidationError('Account ID is required for testOrder');
    if (!order?.symbolId) throw new QuestradeValidationError('symbolId is required in order');
    if (!order?.quantity || order.quantity <= 0) throw new QuestradeValidationError('quantity must be greater than 0');

    return await this.request<OrderImpact>(`v1/accounts/${encodeURIComponent(accountId)}/orders/impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
  }

  /**
   * Submit a new live trading order
   * POST v1/accounts/:accountId/orders
   */
  public async placeOrder(accountId: string, order: OrderPlacementRequest): Promise<OrderPlacementResponse> {
    if (!accountId) throw new QuestradeValidationError('Account ID is required for placeOrder');
    if (!order?.symbolId) throw new QuestradeValidationError('symbolId is required in order');
    if (!order?.quantity || order.quantity <= 0) throw new QuestradeValidationError('quantity must be greater than 0');

    return await this.request<OrderPlacementResponse>(`v1/accounts/${encodeURIComponent(accountId)}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
  }

  /**
   * Replace / modify an existing active order
   * POST v1/accounts/:accountId/orders/:orderId
   */
  public async replaceOrder(
    accountId: string,
    orderId: number,
    order: OrderModificationRequest
  ): Promise<OrderPlacementResponse> {
    if (!accountId || !orderId) throw new QuestradeValidationError('Account ID and Order ID are required');

    return await this.request<OrderPlacementResponse>(
      `v1/accounts/${encodeURIComponent(accountId)}/orders/${encodeURIComponent(orderId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      }
    );
  }

  /**
   * Cancel an open order
   * DELETE v1/accounts/:accountId/orders/:orderId
   */
  public async cancelOrder(accountId: string, orderId: number): Promise<{ orderId: number }> {
    if (!accountId || !orderId) throw new QuestradeValidationError('Account ID and Order ID are required');

    await this.request<null>(
      `v1/accounts/${encodeURIComponent(accountId)}/orders/${encodeURIComponent(orderId)}`,
      {
        method: 'DELETE',
      }
    );
    return { orderId };
  }

  /**
   * Get supported markets and trading venues
   * GET v1/markets
   */
  public async getMarkets(): Promise<MarketInfo[]> {
    const res = await this.request<MarketsResponse>('v1/markets');
    return res.markets || [];
  }

  /**
   * Fetch option quotes based on underlying ID and filters
   * POST v1/markets/quotes/options
   */
  public async getOptionQuotes(filters: OptionQuotesFilter[]): Promise<Level1Quote[]> {
    if (!filters || filters.length === 0) return [];
    const res = await this.request<OptionQuotesResponse>('v1/markets/quotes/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    });
    return res.optionQuotes || [];
  }
}
