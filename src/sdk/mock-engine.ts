/**
 * Questrade API Simulator & Mock Data Engine
 * Generates realistic Level 1 ticks, order books, candlestick histories,
 * and portfolio data for Canadian & US equities adhering strictly to Questrade's schema.
 */

import {
  Account,
  AccountBalance,
  Activity,
  Candle,
  Execution,
  HistoricalCandleInterval,
  Level1Quote,
  OptionChainChainNode,
  Order,
  Position,
  SymbolInfo,
  SymbolSearchResult,
} from './types';

export interface MockMarketStock {
  id: number;
  symbol: string;
  name: string;
  exchange: string;
  currency: 'CAD' | 'USD';
  sector: string;
  basePrice: number;
  currentPrice: number;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  prevClose: number;
  volume: number;
  vwap: number;
  volatility: number;
}

export class MockQuestradeEngine {
  private stocks: Map<number, MockMarketStock> = new Map();
  private symbolIndex: Map<string, number> = new Map();
  private mockAccounts: Account[] = [
    {
      type: 'TFSA',
      number: '28491028',
      status: 'Active',
      isPrimary: true,
      isBilling: true,
      clientAccountType: 'Individual',
    },
    {
      type: 'Margin',
      number: '51928401',
      status: 'Active',
      isPrimary: false,
      isBilling: false,
      clientAccountType: 'Individual',
    },
    {
      type: 'RRSP',
      number: '91823746',
      status: 'Active',
      isPrimary: false,
      isBilling: false,
      clientAccountType: 'Individual',
    },
  ];

  private mockPositions: Map<string, Position[]> = new Map();
  private mockOrders: Map<string, Order[]> = new Map();

  constructor() {
    this.initStocks();
    this.initAccountsAndPositions();
  }

  private initStocks(): void {
    const stockList = [
      { id: 8049, symbol: 'SHOP.TO', name: 'Shopify Inc.', exchange: 'TSX', currency: 'CAD' as const, sector: 'Technology', basePrice: 135.5, vol: 0.008 },
      { id: 9291, symbol: 'RY.TO', name: 'Royal Bank of Canada', exchange: 'TSX', currency: 'CAD' as const, sector: 'Financial Services', basePrice: 168.2, vol: 0.004 },
      { id: 4129, symbol: 'TD.TO', name: 'Toronto-Dominion Bank', exchange: 'TSX', currency: 'CAD' as const, sector: 'Financial Services', basePrice: 84.1, vol: 0.005 },
      { id: 10452, symbol: 'ENB.TO', name: 'Enbridge Inc.', exchange: 'TSX', currency: 'CAD' as const, sector: 'Energy', basePrice: 53.4, vol: 0.004 },
      { id: 12049, symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currency: 'USD' as const, sector: 'Technology', basePrice: 228.4, vol: 0.006 },
      { id: 14092, symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', currency: 'USD' as const, sector: 'Technology', basePrice: 442.8, vol: 0.007 },
      { id: 16840, symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', currency: 'USD' as const, sector: 'Semiconductors', basePrice: 128.6, vol: 0.012 },
      { id: 18491, symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', currency: 'USD' as const, sector: 'Automotive', basePrice: 214.5, vol: 0.015 },
      { id: 7721, symbol: 'BMO.TO', name: 'Bank of Montreal', exchange: 'TSX', currency: 'CAD' as const, sector: 'Financial Services', basePrice: 126.3, vol: 0.004 },
      { id: 6619, symbol: 'CNR.TO', name: 'Canadian National Railway', exchange: 'TSX', currency: 'CAD' as const, sector: 'Industrials', basePrice: 154.7, vol: 0.005 },
    ];

    for (const item of stockList) {
      const spread = Math.max(0.01, Math.round(item.basePrice * 0.0004 * 100) / 100);
      const stock: MockMarketStock = {
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange,
        currency: item.currency,
        sector: item.sector,
        basePrice: item.basePrice,
        currentPrice: item.basePrice,
        bidPrice: Math.round((item.basePrice - spread / 2) * 100) / 100,
        askPrice: Math.round((item.basePrice + spread / 2) * 100) / 100,
        bidSize: Math.floor(Math.random() * 20 + 5) * 100,
        askSize: Math.floor(Math.random() * 20 + 5) * 100,
        openPrice: item.basePrice * (1 + (Math.random() * 0.006 - 0.003)),
        highPrice: item.basePrice * 1.015,
        lowPrice: item.basePrice * 0.985,
        prevClose: item.basePrice * (1 - (Math.random() * 0.008 - 0.004)),
        volume: Math.floor(Math.random() * 800000 + 200000),
        vwap: item.basePrice,
        volatility: item.vol,
      };
      this.stocks.set(item.id, stock);
      this.symbolIndex.set(item.symbol.toUpperCase(), item.id);
    }
  }

  private initAccountsAndPositions(): void {
    // TFSA Positions
    this.mockPositions.set('28491028', [
      {
        symbol: 'SHOP.TO',
        symbolId: 8049,
        openQuantity: 150,
        closedQuantity: 0,
        currentMarketValue: 150 * 135.5,
        currentPrice: 135.5,
        averageEntryPrice: 118.2,
        closedPnl: 0,
        openPnl: 150 * (135.5 - 118.2),
        totalCost: 150 * 118.2,
        isRealTime: true,
        isUnderReorg: false,
      },
      {
        symbol: 'RY.TO',
        symbolId: 9291,
        openQuantity: 100,
        closedQuantity: 0,
        currentMarketValue: 100 * 168.2,
        currentPrice: 168.2,
        averageEntryPrice: 152.0,
        closedPnl: 0,
        openPnl: 100 * (168.2 - 152.0),
        totalCost: 100 * 152.0,
        isRealTime: true,
        isUnderReorg: false,
      },
      {
        symbol: 'NVDA',
        symbolId: 16840,
        openQuantity: 80,
        closedQuantity: 0,
        currentMarketValue: 80 * 128.6,
        currentPrice: 128.6,
        averageEntryPrice: 112.5,
        closedPnl: 0,
        openPnl: 80 * (128.6 - 112.5),
        totalCost: 80 * 112.5,
        isRealTime: true,
        isUnderReorg: false,
      },
    ]);

    // Margin Orders
    this.mockOrders.set('28491028', [
      {
        id: 9812401,
        symbol: 'SHOP.TO',
        symbolId: 8049,
        totalQuantity: 50,
        openQuantity: 0,
        filledQuantity: 50,
        canceledQuantity: 0,
        side: 'Buy',
        orderType: 'Limit',
        limitPrice: 132.0,
        isAllOrNone: false,
        isAnonymous: false,
        avgExecPrice: 131.95,
        lastExecPrice: 131.95,
        source: 'Questrade API',
        timeInForce: 'Day',
        state: 'Executed',
        chainId: 1,
        creationTime: new Date(Date.now() - 3600000 * 4).toISOString(),
        updateTime: new Date(Date.now() - 3600000 * 3.8).toISOString(),
        notes: '',
        primaryRoute: 'AUTO',
        secondaryRoute: 'TSX',
        orderRoute: 'TSX',
        venueHoldingOrder: 'TSX',
        comissionCharged: 4.95,
        exchangeOrderId: 'EX-918237',
        isSignificantShareHolder: false,
        isInsider: false,
        isLimitOffsetInDollar: false,
        userId: 109284,
        legs: [],
        strategyType: 'Single',
      },
      {
        id: 9812402,
        symbol: 'AAPL',
        symbolId: 12049,
        totalQuantity: 25,
        openQuantity: 25,
        filledQuantity: 0,
        canceledQuantity: 0,
        side: 'Buy',
        orderType: 'Limit',
        limitPrice: 220.0,
        isAllOrNone: false,
        isAnonymous: false,
        source: 'Questrade API',
        timeInForce: 'GoodTillCancelled',
        state: 'Accepted',
        chainId: 2,
        creationTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        updateTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        notes: 'Working limit order',
        primaryRoute: 'AUTO',
        secondaryRoute: 'NASDAQ',
        orderRoute: 'NASDAQ',
        venueHoldingOrder: 'NASDAQ',
        comissionCharged: 0,
        exchangeOrderId: 'EX-918238',
        isSignificantShareHolder: false,
        isInsider: false,
        isLimitOffsetInDollar: false,
        userId: 109284,
        legs: [],
        strategyType: 'Single',
      },
    ]);
  }

  /**
   * Simulate a live price tick for all or specified symbols
   */
  public generateNextTick(symbolId?: number): Level1Quote[] {
    const targetStocks = symbolId ? [this.stocks.get(symbolId)].filter(Boolean) : Array.from(this.stocks.values());
    const updatedQuotes: Level1Quote[] = [];

    for (const stock of targetStocks as MockMarketStock[]) {
      // Random walk with drift and volatility
      const deltaPercent = (Math.random() - 0.495) * stock.volatility;
      const newPrice = Math.max(1, Math.round((stock.currentPrice * (1 + deltaPercent)) * 100) / 100);
      const spread = Math.max(0.01, Math.round(newPrice * 0.0004 * 100) / 100);

      const tickDirection = newPrice > stock.currentPrice ? 'Up' : newPrice < stock.currentPrice ? 'Down' : 'Equal';
      stock.currentPrice = newPrice;
      stock.bidPrice = Math.round((newPrice - spread / 2) * 100) / 100;
      stock.askPrice = Math.round((newPrice + spread / 2) * 100) / 100;
      stock.bidSize = Math.floor(Math.random() * 25 + 5) * 100;
      stock.askSize = Math.floor(Math.random() * 25 + 5) * 100;
      stock.volume += Math.floor(Math.random() * 500 + 50);

      if (newPrice > stock.highPrice) stock.highPrice = newPrice;
      if (newPrice < stock.lowPrice) stock.lowPrice = newPrice;

      const quote: Level1Quote = {
        symbol: stock.symbol,
        symbolId: stock.id,
        bidPrice: stock.bidPrice,
        bidSize: stock.bidSize,
        askPrice: stock.askPrice,
        askSize: stock.askSize,
        lastTradePriceTraded: stock.currentPrice,
        lastTradeSize: Math.floor(Math.random() * 10 + 1) * 100,
        lastTradeTick: tickDirection,
        lastTradeTime: new Date().toISOString(),
        volume: stock.volume,
        openPrice: stock.openPrice,
        highPrice: stock.highPrice,
        lowPrice: stock.lowPrice,
        delay: 0,
        isHalted: false,
        vwap: stock.vwap,
      };

      updatedQuotes.push(quote);
    }

    return updatedQuotes;
  }

  // Query Handlers matching REST responses

  public getAccounts(): Account[] {
    return this.mockAccounts;
  }

  public getPositions(accountId: string): Position[] {
    const pos = this.mockPositions.get(accountId) || [];
    // Update current price & pnl based on current live stock price
    return pos.map((p) => {
      const stock = this.stocks.get(p.symbolId);
      const curPrice = stock ? stock.currentPrice : p.currentPrice;
      const marketVal = p.openQuantity * curPrice;
      const openPnl = marketVal - p.totalCost;
      return {
        ...p,
        currentPrice: curPrice,
        currentMarketValue: Math.round(marketVal * 100) / 100,
        openPnl: Math.round(openPnl * 100) / 100,
      };
    });
  }

  public getBalances(accountId: string): AccountBalance {
    const positions = this.getPositions(accountId);
    let cadMkt = 0;
    let usdMkt = 0;

    for (const p of positions) {
      const stock = this.stocks.get(p.symbolId);
      if (stock?.currency === 'CAD') cadMkt += p.currentMarketValue;
      else usdMkt += p.currentMarketValue;
    }

    const cadCash = 18450.25;
    const usdCash = 9320.5;

    return {
      perCurrencyBalances: [
        {
          currency: 'CAD',
          cash: cadCash,
          marketValue: cadMkt,
          totalEquity: cadCash + cadMkt,
          buyingPower: cadCash * 3,
          maintenanceExcess: cadCash,
          isRealTime: true,
        },
        {
          currency: 'USD',
          cash: usdCash,
          marketValue: usdMkt,
          totalEquity: usdCash + usdMkt,
          buyingPower: usdCash * 3,
          maintenanceExcess: usdCash,
          isRealTime: true,
        },
      ],
      combinedBalances: [
        {
          currency: 'CAD',
          cash: cadCash + usdCash * 1.37,
          marketValue: cadMkt + usdMkt * 1.37,
          totalEquity: cadCash + cadMkt + (usdCash + usdMkt) * 1.37,
          buyingPower: (cadCash + usdCash * 1.37) * 3,
          maintenanceExcess: cadCash + usdCash * 1.37,
          isRealTime: true,
        },
      ],
      sodPerCurrencyBalances: [
        {
          currency: 'CAD',
          cash: 18450.25,
          marketValue: cadMkt * 0.99,
          totalEquity: 18450.25 + cadMkt * 0.99,
          buyingPower: 18450.25 * 3,
          maintenanceExcess: 18450.25,
          isRealTime: false,
        },
      ],
      sodCombinedBalances: [],
    };
  }

  public getOrders(accountId: string): Order[] {
    return this.mockOrders.get(accountId) || [];
  }

  public getExecutions(accountId: string): Execution[] {
    return [
      {
        symbol: 'SHOP.TO',
        symbolId: 8049,
        id: 549102,
        sequenceNumber: 1,
        orderId: 9812401,
        orderPlacementCommission: 4.95,
        tradeId: 18294,
        side: 'Buy',
        price: 131.95,
        notes: 'Filled on TSX',
        venue: 'TSX',
        totalCost: 50 * 131.95 + 4.95,
        orderRoute: 'TSX',
        executingBroker: 'Questrade Inc.',
        commission: 4.95,
        executionTime: new Date(Date.now() - 3600000 * 3.8).toISOString(),
      },
    ];
  }

  public getActivities(accountId: string): Activity[] {
    return [
      {
        tradeDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        transactionDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        settlementDate: new Date(Date.now() - 86400000).toISOString(),
        action: 'BUY',
        symbol: 'SHOP.TO',
        symbolId: 8049,
        description: 'Shopify Inc. Subordinate Voting Shares',
        currency: 'CAD',
        quantity: 50,
        price: 131.95,
        grossAmount: -6597.5,
        commission: -4.95,
        netAmount: -6602.45,
        type: 'Trades',
      },
      {
        tradeDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        transactionDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        settlementDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        action: 'DIV',
        symbol: 'RY.TO',
        symbolId: 9291,
        description: 'Royal Bank Dividend Payment',
        currency: 'CAD',
        quantity: 100,
        price: 1.38,
        grossAmount: 138.0,
        commission: 0,
        netAmount: 138.0,
        type: 'Dividends',
      },
    ];
  }

  public searchSymbols(prefix: string): SymbolSearchResult[] {
    const p = prefix.trim().toUpperCase();
    const results: SymbolSearchResult[] = [];

    for (const stock of this.stocks.values()) {
      if (stock.symbol.toUpperCase().includes(p) || stock.name.toUpperCase().includes(p)) {
        results.push({
          symbol: stock.symbol,
          symbolId: stock.id,
          description: stock.name,
          securityType: 'Stock',
          listingExchange: stock.exchange,
          isTradable: true,
          isQuotable: true,
          currency: stock.currency,
        });
      }
    }
    return results;
  }

  public getSymbolsByIds(ids: number[]): SymbolInfo[] {
    const list: SymbolInfo[] = [];
    for (const id of ids) {
      const stock = this.stocks.get(id);
      if (stock) {
        list.push({
          symbol: stock.symbol,
          symbolId: stock.id,
          description: stock.name,
          securityType: 'Stock',
          listingExchange: stock.exchange,
          isTradable: true,
          isQuotable: true,
          currency: stock.currency,
          minTick: 0.01,
          industrySector: stock.sector,
          prevDayClosePrice: stock.prevClose,
          highPrice52: stock.basePrice * 1.3,
          lowPrice52: stock.basePrice * 0.75,
          averageVol3Months: stock.volume * 1.2,
          outstandingShares: 1250000000,
          pe: 28.5,
          yield: stock.currency === 'CAD' ? 3.8 : 0.6,
        });
      }
    }
    return list;
  }

  public getQuotes(ids: number[]): Level1Quote[] {
    const quotes: Level1Quote[] = [];
    for (const id of ids) {
      const stock = this.stocks.get(id);
      if (stock) {
        quotes.push({
          symbol: stock.symbol,
          symbolId: stock.id,
          bidPrice: stock.bidPrice,
          bidSize: stock.bidSize,
          askPrice: stock.askPrice,
          askSize: stock.askSize,
          lastTradePriceTraded: stock.currentPrice,
          lastTradeSize: 100,
          lastTradeTick: 'Equal',
          lastTradeTime: new Date().toISOString(),
          volume: stock.volume,
          openPrice: stock.openPrice,
          highPrice: stock.highPrice,
          lowPrice: stock.lowPrice,
          delay: 0,
          isHalted: false,
          vwap: stock.vwap,
        });
      }
    }
    return quotes;
  }

  public getOptionChain(symbolId: number): OptionChainChainNode[] {
    const stock = this.stocks.get(symbolId);
    if (!stock) return [];

    const base = stock.currentPrice;
    const strikes = [
      Math.round((base * 0.9) / 5) * 5,
      Math.round((base * 0.95) / 5) * 5,
      Math.round(base / 5) * 5,
      Math.round((base * 1.05) / 5) * 5,
      Math.round((base * 1.1) / 5) * 5,
    ];

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(19);

    return [
      {
        expiryDate: nextMonth.toISOString().split('T')[0] + 'T00:00:00.000000-04:00',
        description: `${stock.symbol} Monthly Options`,
        listingExchange: 'MX',
        optionExerciseType: 'American',
        chainPerRoot: [
          {
            root: stock.symbol.replace('.TO', ''),
            strikePrices: strikes,
            multiplier: 100,
          },
        ],
      },
    ];
  }

  public getCandles(symbolId: number, interval: HistoricalCandleInterval = 'OneDay', count: number = 30): Candle[] {
    const stock = this.stocks.get(symbolId);
    const base = stock ? stock.currentPrice : 100;
    const candles: Candle[] = [];

    let currentClose = base * 0.85;
    const now = new Date();

    const intervalMinutes: Record<HistoricalCandleInterval, number> = {
      OneMinute: 1,
      TwoMinutes: 2,
      ThreeMinutes: 3,
      FourMinutes: 4,
      FiveMinutes: 5,
      TenMinutes: 10,
      FifteenMinutes: 15,
      TwentyMinutes: 20,
      HalfHour: 30,
      OneHour: 60,
      TwoHours: 120,
      FourHours: 240,
      OneDay: 1440,
      OneWeek: 10080,
      OneMonth: 43200,
      OneYear: 525600,
    };

    const stepMs = (intervalMinutes[interval] || 1440) * 60 * 1000;

    for (let i = count - 1; i >= 0; i--) {
      const startTime = new Date(now.getTime() - (i + 1) * stepMs);
      const endTime = new Date(now.getTime() - i * stepMs);

      const change = (Math.random() - 0.48) * (base * 0.02);
      const open = currentClose;
      const close = Math.round((open + change) * 100) / 100;
      const high = Math.round((Math.max(open, close) + Math.random() * (base * 0.015)) * 100) / 100;
      const low = Math.round((Math.min(open, close) - Math.random() * (base * 0.015)) * 100) / 100;
      const vol = Math.floor(Math.random() * 50000 + 10000);

      currentClose = close;

      candles.push({
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        open,
        close,
        high,
        low,
        volume: vol,
        VWAP: Math.round(((open + high + low + close) / 4) * 100) / 100,
      });
    }

    return candles;
  }

  public getAllStocks(): MockMarketStock[] {
    return Array.from(this.stocks.values());
  }
}

// Global Singleton for in-memory sharing
export const mockQuestradeEngine = new MockQuestradeEngine();
