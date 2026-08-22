/**
 * Questrade API TypeScript SDK - Unified Market Feed Manager
 * Unified interface wrapping both WebSocket Streaming and Polling engines
 * with automatic fallback and seamless event handling.
 */

import { Level1Quote, MarketFeedOptions, FeedStats, FeedEventListener } from './types';
import { QuestradeClient } from './client';
import { QuestradeStreamFeed } from './streaming';
import { QuestradePollFeed } from './polling';
import { QuestradeError } from './errors';

type EventCallback = (...args: any[]) => void;

export class QuestradeMarketFeed {
  private client: QuestradeClient;
  private mode: 'stream' | 'poll' | 'auto';
  private streamFeed: QuestradeStreamFeed;
  private pollFeed: QuestradePollFeed;
  private activeFeed: 'stream' | 'poll' | 'none' = 'none';
  private subscribedSymbolIds: Set<number> = new Set();
  private listeners: Map<string, Set<EventCallback>> = new Map();

  constructor(client: QuestradeClient, options: MarketFeedOptions = {}) {
    this.client = client;
    this.mode = options.mode ?? 'auto';

    this.streamFeed = new QuestradeStreamFeed(client, options.streamOptions);
    this.pollFeed = new QuestradePollFeed(client, options.pollOptions);

    this.setupListeners();
  }

  private setupListeners(): void {
    // Forward quotes from streaming feed
    this.streamFeed.on('quote', (quote) => {
      if (this.activeFeed === 'stream') {
        this.emit('quote', quote);
      }
    });

    // Forward quotes from polling feed
    this.pollFeed.on('quote', (quote) => {
      if (this.activeFeed === 'poll') {
        this.emit('quote', quote);
      }
    });

    // Forward stats
    this.streamFeed.on('stats', (stats) => {
      if (this.activeFeed === 'stream') this.emit('stats', stats);
    });
    this.pollFeed.on('stats', (stats) => {
      if (this.activeFeed === 'poll') this.emit('stats', stats);
    });

    // Handle stream error in 'auto' mode -> switch to polling
    this.streamFeed.on('error', (err) => {
      if (this.mode === 'auto' && this.activeFeed === 'stream') {
        console.warn('[QuestradeMarketFeed] Streaming failed in auto mode, falling back to Polling feed.');
        this.switchToPolling('Streaming error fallback');
      }
      this.emit('error', err);
    });

    this.pollFeed.on('error', (err) => {
      this.emit('error', err);
    });
  }

  // ==========================================
  // Public Feed Control
  // ==========================================

  public async start(): Promise<void> {
    const symbolList = Array.from(this.subscribedSymbolIds);

    if (this.mode === 'stream' || this.mode === 'auto') {
      try {
        this.activeFeed = 'stream';
        this.emit('modeChange', 'stream', 'Initial start');
        this.streamFeed.subscribeQuotes(symbolList);
        await this.streamFeed.connect();
        this.emit('connected');
        return;
      } catch (err: any) {
        if (this.mode === 'auto') {
          console.warn('[QuestradeMarketFeed] Initial stream connect failed, falling back to polling:', err.message);
          this.switchToPolling('Initial stream connect failed');
          return;
        }
        throw err;
      }
    }

    // Polling mode
    this.switchToPolling('Explicit polling mode');
  }

  private switchToPolling(reason?: string): void {
    const prevFeed = this.activeFeed;
    this.activeFeed = 'poll';
    try {
      this.streamFeed.disconnect();
    } catch {
      // ignore
    }
    this.pollFeed.subscribeQuotes(Array.from(this.subscribedSymbolIds));
    this.pollFeed.start();
    if (prevFeed !== 'poll') {
      this.emit('modeChange', 'poll', reason);
    }
    this.emit('connected');
  }

  public stop(): void {
    this.activeFeed = 'none';
    this.streamFeed.disconnect();
    this.pollFeed.stop();
    this.emit('disconnected');
  }

  public subscribeQuotes(symbolIds: number[]): void {
    for (const id of symbolIds) {
      this.subscribedSymbolIds.add(id);
    }
    if (this.activeFeed === 'stream') {
      this.streamFeed.subscribeQuotes(symbolIds);
    } else if (this.activeFeed === 'poll') {
      this.pollFeed.subscribeQuotes(symbolIds);
    }
  }

  public subscribe(symbolIds: number[]): void {
    this.subscribeQuotes(symbolIds);
  }

  public unsubscribeQuotes(symbolIds: number[]): void {
    for (const id of symbolIds) {
      this.subscribedSymbolIds.delete(id);
    }
    if (this.activeFeed === 'stream') {
      this.streamFeed.unsubscribeQuotes(symbolIds);
    } else if (this.activeFeed === 'poll') {
      this.pollFeed.unsubscribeQuotes(symbolIds);
    }
  }

  public unsubscribe(symbolIds: number[]): void {
    this.unsubscribeQuotes(symbolIds);
  }

  public getStats(): Readonly<FeedStats> {
    if (this.activeFeed === 'stream') {
      return this.streamFeed.getStats();
    } else if (this.activeFeed === 'poll') {
      return this.pollFeed.getStats();
    }
    return {
      mode: 'idle',
      subscribedCount: this.subscribedSymbolIds.size,
      totalTicksReceived: 0,
      ticksPerSecond: 0,
      lastTickTimestamp: null,
      connectionState: 'disconnected',
      latencyMs: 0,
      errorCount: 0,
    };
  }

  public getActiveEngine(): 'stream' | 'poll' | 'none' {
    return this.activeFeed;
  }

  // ==========================================
  // Event Emitter
  // ==========================================

  public on(event: 'quote', listener: FeedEventListener<Level1Quote>): this;
  public on(event: 'modeChange', listener: (newMode: 'stream' | 'poll', reason?: string) => void): this;
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
    if (set) set.delete(listener);
    return this;
  }

  private emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`[QuestradeMarketFeed] Error in '${event}' event listener:`, err);
        }
      }
    }
  }
}
