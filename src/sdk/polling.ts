/**
 * Questrade API TypeScript SDK - High-Efficiency Polling Feed Engine
 * Batches quote requests, deduplicates ticks, handles rate-limit backoff,
 * and emits normalized quote events.
 */

import { Level1Quote, PollFeedOptions, FeedStats, FeedEventListener } from './types';
import { QuestradeClient } from './client';
import { QuestradeError } from './errors';

type EventCallback = (...args: any[]) => void;

export class QuestradePollFeed {
  private client: QuestradeClient;
  private options: Required<PollFeedOptions>;
  private subscribedSymbolIds: Set<number> = new Set();
  private isRunning: boolean = false;
  private timer: any = null;
  private lastQuoteCache: Map<number, Level1Quote> = new Map();

  // Event Listeners Map
  private listeners: Map<string, Set<EventCallback>> = new Map();

  // Metrics
  private stats: FeedStats = {
    mode: 'poll',
    subscribedCount: 0,
    totalTicksReceived: 0,
    ticksPerSecond: 0,
    lastTickTimestamp: null,
    connectionState: 'disconnected',
    latencyMs: 0,
    errorCount: 0,
  };
  private tickTimestamps: number[] = [];
  private currentBackoffDelayMs: number = 0;

  constructor(client: QuestradeClient, options: PollFeedOptions = {}) {
    this.client = client;
    this.options = {
      intervalMs: Math.max(250, options.intervalMs ?? 1000),
      batchSize: Math.min(100, Math.max(1, options.batchSize ?? 50)),
      deduplicate: options.deduplicate ?? true,
      adaptive: options.adaptive ?? true,
    };
  }

  // ==========================================
  // Event Emitter Implementation
  // ==========================================

  public on(event: 'quote', listener: FeedEventListener<Level1Quote>): this;
  public on(event: 'connected', listener: () => void): this;
  public on(event: 'disconnected', listener: (reason?: string) => void): this;
  public on(event: 'error', listener: FeedEventListener<QuestradeError>): this;
  public on(event: 'stats', listener: FeedEventListener<FeedStats>): this;
  public on(event: string, listener: EventCallback): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  public off(event: string, listener: EventCallback): this {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
    return this;
  }

  private emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`[QuestradePollFeed] Listener error on event '${event}':`, err);
        }
      }
    }
  }

  // ==========================================
  // Polling Lifecycle
  // ==========================================

  /**
   * Start polling market data
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentBackoffDelayMs = 0;
    this.stats.connectionState = 'connected';
    this.emit('connected');
    this.emitStats();
    this.scheduleNextPoll(0);
  }

  /**
   * Stop polling
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stats.connectionState = 'disconnected';
    this.emit('disconnected', 'Polling stopped');
    this.emitStats();
  }

  /**
   * Update polling interval on the fly
   */
  public setInterval(intervalMs: number): void {
    this.options.intervalMs = Math.max(250, intervalMs);
  }

  /**
   * Subscribe to quotes for symbol IDs
   */
  public subscribeQuotes(symbolIds: number[]): void {
    for (const id of symbolIds) {
      this.subscribedSymbolIds.add(id);
    }
    this.stats.subscribedCount = this.subscribedSymbolIds.size;
    this.emitStats();

    // If running and no timer active, trigger immediate poll
    if (this.isRunning && !this.timer) {
      this.scheduleNextPoll(0);
    }
  }

  /**
   * Convenience alias for subscribeQuotes
   */
  public subscribe(symbolIds: number[]): void {
    this.subscribeQuotes(symbolIds);
  }

  /**
   * Unsubscribe from quotes for symbol IDs
   */
  public unsubscribeQuotes(symbolIds: number[]): void {
    for (const id of symbolIds) {
      this.subscribedSymbolIds.delete(id);
      this.lastQuoteCache.delete(id);
    }
    this.stats.subscribedCount = this.subscribedSymbolIds.size;
    this.emitStats();
  }

  /**
   * Convenience alias for unsubscribeQuotes
   */
  public unsubscribe(symbolIds: number[]): void {
    this.unsubscribeQuotes(symbolIds);
  }

  /**
   * Get current polling metrics
   */
  public getStats(): Readonly<FeedStats> {
    return { ...this.stats };
  }

  public isPolling(): boolean {
    return this.isRunning;
  }

  // ==========================================
  // Polling Engine Internals
  // ==========================================

  private scheduleNextPoll(delayMs?: number): void {
    if (!this.isRunning) return;
    if (this.timer) {
      clearTimeout(this.timer);
    }

    const wait = delayMs !== undefined ? delayMs : this.options.intervalMs + this.currentBackoffDelayMs;

    this.timer = setTimeout(async () => {
      this.timer = null;
      if (!this.isRunning) return;

      const startTime = Date.now();
      try {
        await this.pollCycle();
        // Successfully polled -> reduce backoff gradually
        if (this.currentBackoffDelayMs > 0) {
          this.currentBackoffDelayMs = Math.max(0, this.currentBackoffDelayMs - 500);
        }
        this.stats.latencyMs = Date.now() - startTime;
      } catch (err: any) {
        this.stats.errorCount++;
        this.stats.lastError = err.message || 'Polling error';

        if (this.options.adaptive) {
          // Add backoff delay on error
          this.currentBackoffDelayMs = Math.min(this.currentBackoffDelayMs + 2000, 15000);
        }

        this.emit('error', err instanceof QuestradeError ? err : new QuestradeError(err.message, { message: err.message }));
      } finally {
        if (this.isRunning) {
          this.scheduleNextPoll();
        }
      }
    }, wait);
  }

  private async pollCycle(): Promise<void> {
    const symbolIds = Array.from(this.subscribedSymbolIds);
    if (symbolIds.length === 0) return;

    // Chunk into batches (max batchSize, e.g. 50 or 100)
    const batches: number[][] = [];
    for (let i = 0; i < symbolIds.length; i += this.options.batchSize) {
      batches.push(symbolIds.slice(i, i + this.options.batchSize));
    }

    const now = Date.now();

    for (const batch of batches) {
      if (!this.isRunning) break;
      const quotes = await this.client.getQuotes(batch);

      for (const quote of quotes) {
        if (!quote) continue;

        if (this.options.deduplicate) {
          const prev = this.lastQuoteCache.get(quote.symbolId);
          if (prev && this.isIdenticalQuote(prev, quote)) {
            continue; // Skip unchanged quote
          }
        }

        this.lastQuoteCache.set(quote.symbolId, quote);
        this.stats.totalTicksReceived++;
        this.stats.lastTickTimestamp = now;
        this.recordTick(now);
        this.emit('quote', quote);
      }
    }

    this.emitStats();
  }

  private isIdenticalQuote(a: Level1Quote, b: Level1Quote): boolean {
    return (
      a.bidPrice === b.bidPrice &&
      a.bidSize === b.bidSize &&
      a.askPrice === b.askPrice &&
      a.askSize === b.askSize &&
      a.lastTradePriceTraded === b.lastTradePriceTraded &&
      a.lastTradeSize === b.lastTradeSize &&
      a.volume === b.volume &&
      a.isHalted === b.isHalted
    );
  }

  private recordTick(now: number): void {
    this.tickTimestamps.push(now);
    const windowStart = now - 5000;
    while (this.tickTimestamps.length > 0 && this.tickTimestamps[0] < windowStart) {
      this.tickTimestamps.shift();
    }
    this.stats.ticksPerSecond = Math.round((this.tickTimestamps.length / 5) * 10) / 10;
  }

  private emitStats(): void {
    this.emit('stats', this.getStats());
  }
}
