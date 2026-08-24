/**
 * Questrade API TypeScript SDK - Real-Time WebSocket Streaming Engine
 * Implements official Questrade L1 Market Data Streaming and Order Push Feeds
 */

import { Level1Quote, Order, StreamOptions, FeedStats, FeedEventListener } from './types';
import { QuestradeClient } from './client';
import { QuestradeApiErrorCode, QuestradeStreamError } from './errors';

type EventCallback = (...args: any[]) => void;

export class QuestradeStreamFeed {
  private client: QuestradeClient;
  private options: Required<Omit<StreamOptions, 'webSocketImpl'>> & { webSocketImpl?: any };
  private ws: any = null;
  private subscribedSymbolIds: Set<number> = new Set();
  private isConnecting: boolean = false;
  private isExplicitlyClosed: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private lastHeartbeat: number = 0;
  private streamPort: number | null = null;
  private streamAuthenticated: boolean = false;

  // Event Listeners Map
  private listeners: Map<string, Set<EventCallback>> = new Map();

  // Metrics
  private stats: FeedStats = {
    mode: 'stream',
    subscribedCount: 0,
    totalTicksReceived: 0,
    ticksPerSecond: 0,
    lastTickTimestamp: null,
    connectionState: 'disconnected',
    latencyMs: 0,
    errorCount: 0,
  };
  private tickTimestamps: number[] = [];

  constructor(client: QuestradeClient, options: StreamOptions = {}) {
    this.client = client;
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      reconnectDelayMs: options.reconnectDelayMs ?? 1000,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 30000,
      webSocketImpl: options.webSocketImpl,
    };
  }

  // ==========================================
  // Event Emitter Implementation
  // ==========================================

  public on(event: 'quote', listener: FeedEventListener<Level1Quote>): this;
  public on(event: 'order', listener: FeedEventListener<Order>): this;
  public on(event: 'connected', listener: () => void): this;
  public on(event: 'disconnected', listener: (reason?: string) => void): this;
  public on(event: 'reconnecting', listener: (attempt: number) => void): this;
  public on(event: 'error', listener: FeedEventListener<QuestradeStreamError>): this;
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
          console.error(`[QuestradeStreamFeed] Listener error on event '${event}':`, err);
        }
      }
    }
  }

  // ==========================================
  // Connection Lifecycle
  // ==========================================

  /**
   * Connect to the Questrade streaming server
   */
  public async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      return; // already connecting or open
    }

    this.isExplicitlyClosed = false;
    this.isConnecting = true;
    this.updateState('connecting');

    try {
      const credentials = this.client.getCredentials();
      if (!credentials?.accessToken || !credentials?.apiServer) {
        // Try to authenticate if refreshToken available
        await this.client.exchangeRefreshToken();
      }

      const activeCreds = this.client.getCredentials();
      if (!activeCreds) {
        throw new QuestradeStreamError('Cannot connect stream: Client is not authenticated.', {
          code: QuestradeApiErrorCode.STREAM_AUTHENTICATION_FAILED,
          message: 'Missing authentication credentials.',
        });
      }

      // Step 1: Request stream port
      const symbolIds = Array.from(this.subscribedSymbolIds);
      try {
        this.streamPort = await this.client.getStreamPort('WebSocket', symbolIds.length ? symbolIds : [8049]);
      } catch (err: any) {
        throw new QuestradeStreamError(`Failed to negotiate stream port: ${err.message}`, {
          code: QuestradeApiErrorCode.STREAM_PORT_UNAVAILABLE,
          message: err.message,
          rawResponse: err,
        });
      }

      // Step 2: Build WebSocket URL
      // Questrade stream host is derived from api_server and streamPort
      const serverUrl = new URL(activeCreds.apiServer);
      const wsProtocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${serverUrl.hostname}:${this.streamPort}/v1/markets/quotes?mode=WebSocket`;

      const WebSocketClass =
        this.options.webSocketImpl ||
        (typeof globalThis !== 'undefined' && (globalThis as any).WebSocket) ||
        (typeof window !== 'undefined' && window.WebSocket);

      if (!WebSocketClass) {
        throw new QuestradeStreamError('WebSocket is not supported in this runtime environment.', {
          code: QuestradeApiErrorCode.STREAM_CONNECTION_FAILED,
          message: 'WebSocket class unavailable.',
        });
      }

      this.ws = new WebSocketClass(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.streamAuthenticated = false;
        this.updateState('connecting');

        // Step 3: Questrade handshake - Send access_token (without Bearer prefix)
        const tokenToSend = activeCreds.accessToken;
        this.ws.send(tokenToSend);

        this.startHeartbeat();

      };

      this.ws.onmessage = (event: any) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (event: any) => {
        this.stats.errorCount++;
        const streamErr = new QuestradeStreamError('WebSocket connection error occurred', {
          code: QuestradeApiErrorCode.STREAM_CONNECTION_FAILED,
          message: 'WebSocket error',
          rawResponse: event,
        });
        this.emit('error', streamErr);
      };

      this.ws.onclose = (event: any) => {
        this.stopHeartbeat();
        this.ws = null;
        this.streamAuthenticated = false;
        this.isConnecting = false;

        if (this.isExplicitlyClosed) {
          this.updateState('disconnected');
          this.emit('disconnected', 'Client disconnected');
        } else {
          this.updateState('disconnected');
          this.emit('disconnected', `Closed with code ${event.code}: ${event.reason || 'Server disconnected'}`);
          this.scheduleReconnect();
        }
      };
    } catch (err: any) {
      this.isConnecting = false;
      this.updateState('error');
      const streamErr =
        err instanceof QuestradeStreamError
          ? err
          : new QuestradeStreamError(`Stream connection failed: ${err.message}`, {
              code: QuestradeApiErrorCode.STREAM_CONNECTION_FAILED,
              message: err.message,
            });
      this.emit('error', streamErr);
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to real-time quotes for symbol IDs
   */
  public subscribeQuotes(symbolIds: number[]): void {
    let changed = false;
    for (const id of symbolIds) {
      if (!this.subscribedSymbolIds.has(id)) {
        this.subscribedSymbolIds.add(id);
        changed = true;
      }
    }

    this.stats.subscribedCount = this.subscribedSymbolIds.size;
    this.emitStats();

    if (changed && this.isConnected()) {
      this.sendSubscriptionUpdate();
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
    let changed = false;
    for (const id of symbolIds) {
      if (this.subscribedSymbolIds.has(id)) {
        this.subscribedSymbolIds.delete(id);
        changed = true;
      }
    }

    this.stats.subscribedCount = this.subscribedSymbolIds.size;
    this.emitStats();

    if (changed && this.isConnected()) {
      this.sendSubscriptionUpdate();
    }
  }

  /**
   * Convenience alias for unsubscribeQuotes
   */
  public unsubscribe(symbolIds: number[]): void {
    this.unsubscribeQuotes(symbolIds);
  }

  /**
   * Disconnect the WebSocket stream cleanly
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client closed');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.updateState('disconnected');
  }

  /**
   * Get current live feed statistics
   */
  public getStats(): Readonly<FeedStats> {
    return { ...this.stats };
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1;
  }

  // ==========================================
  // Internal Helpers
  // ==========================================

  private sendSubscriptionUpdate(): void {
    if (!this.isConnected() || !this.streamAuthenticated) return;
    try {
      const payload = JSON.stringify({
        action: 'subscribe',
        symbolIds: Array.from(this.subscribedSymbolIds),
      });
      this.ws.send(payload);
    } catch (err) {
      console.warn('[QuestradeStreamFeed] Failed to send subscription update:', err);
    }
  }

  private handleMessage(data: any): void {
    const receiveTime = Date.now();
    try {
      const messageStr = typeof data === 'string' ? data : data.toString();
      if (!messageStr || messageStr.trim() === '') return;

      const parsed = JSON.parse(messageStr);

      // Handle heartbeat / keep-alive
      if (parsed.type === 'heartbeat' || parsed.heartbeat) {
        this.lastHeartbeat = receiveTime;
        return;
      }

      if (parsed.type === 'handshake') {
        if (parsed.status !== 'authenticated') {
          throw new QuestradeStreamError('Stream authentication failed', {
            code: QuestradeApiErrorCode.STREAM_AUTHENTICATION_FAILED,
            message: parsed.message || 'The stream rejected the access token.',
            rawResponse: parsed,
          });
        }
        this.streamAuthenticated = true;
        this.updateState('connected');
        this.emit('connected');
        if (this.subscribedSymbolIds.size > 0) {
          this.sendSubscriptionUpdate();
        }
        return;
      }

      // Handle quotes push
      if (parsed.quotes && Array.isArray(parsed.quotes)) {
        for (const quote of parsed.quotes) {
          this.stats.totalTicksReceived++;
          this.stats.lastTickTimestamp = receiveTime;
          this.recordTick(receiveTime);

          // Calculate latency if quote contains timestamp
          if (quote.lastTradeTime) {
            const tradeMs = new Date(quote.lastTradeTime).getTime();
            if (!isNaN(tradeMs)) {
              this.stats.latencyMs = Math.max(0, receiveTime - tradeMs);
            }
          }

          this.emit('quote', quote);
        }
        this.emitStats();
      }

      // Handle order notification push
      if (parsed.orders && Array.isArray(parsed.orders)) {
        for (const order of parsed.orders) {
          this.emit('order', order);
        }
      }
    } catch (err: any) {
      // Non-JSON or corrupt frame
      if (err instanceof QuestradeStreamError && err.code === QuestradeApiErrorCode.STREAM_AUTHENTICATION_FAILED) {
        this.ws?.close(4001, 'Stream authentication failed');
      }
      this.emit(
        'error',
        new QuestradeStreamError(`Failed to parse stream message: ${err.message}`, {
          code: QuestradeApiErrorCode.STREAM_CONNECTION_FAILED,
          message: err.message,
          rawResponse: data,
        })
      );
    }
  }

  private recordTick(now: number): void {
    this.tickTimestamps.push(now);
    // Keep timestamps from the last 5 seconds
    const windowStart = now - 5000;
    while (this.tickTimestamps.length > 0 && this.tickTimestamps[0] < windowStart) {
      this.tickTimestamps.shift();
    }
    this.stats.ticksPerSecond = Math.round((this.tickTimestamps.length / 5) * 10) / 10;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastHeartbeat = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected()) return;
      const now = Date.now();
      if (now - this.lastHeartbeat > this.options.heartbeatIntervalMs * 2) {
        console.warn('[QuestradeStreamFeed] Heartbeat timeout. Reconnecting...');
        this.ws?.close(4000, 'Heartbeat timeout');
      }
    }, this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || !this.options.autoReconnect) return;

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.updateState('error');
      this.emit(
        'error',
        new QuestradeStreamError(`Exceeded maximum reconnect attempts (${this.options.maxReconnectAttempts})`, {
          code: QuestradeApiErrorCode.STREAM_CONNECTION_FAILED,
          message: 'Max reconnect attempts reached.',
        })
      );
      return;
    }

    this.reconnectAttempts++;
    this.updateState('reconnecting');
    this.emit('reconnecting', this.reconnectAttempts);

    // Exponential backoff with jitter
    const delay = Math.min(
      this.options.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1) + Math.random() * 500,
      30000
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private updateState(state: FeedStats['connectionState']): void {
    this.stats.connectionState = state;
    this.emitStats();
  }

  private emitStats(): void {
    this.emit('stats', this.getStats());
  }
}
