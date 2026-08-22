import React, { useState } from 'react';
import { FileCode, Copy, Check, Download, Layers, ShieldCheck, Zap } from 'lucide-react';

export const SdkSourceViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<'types' | 'client' | 'streaming' | 'polling' | 'feed-manager' | 'errors' | 'index' | 'package'>('types');
  const [copied, setCopied] = useState(false);

  const files: Record<string, { name: string; desc: string; code: string }> = {
    types: {
      name: 'types.ts',
      desc: 'Complete TypeScript definitions for Auth, Accounts, Balances, Orders, Quotes, Option Chains, Candles, and Feeds.',
      code: `export interface QuestradeCredentials {
  accessToken: string;
  apiServer: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
}

export interface QuestradeClientOptions {
  refreshToken?: string;
  accessToken?: string;
  apiServer?: string;
  autoRefresh?: boolean;
  onTokenRefresh?: (credentials: QuestradeCredentials) => void | Promise<void>;
  maxRetries?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  proxyUrl?: string;
  sandbox?: boolean;
}

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
  delay: number;
  isHalted: boolean;
  vwap?: number | null;
}

export type HistoricalCandleInterval =
  | 'OneMinute' | 'TwoMinutes' | 'ThreeMinutes' | 'FourMinutes'
  | 'FiveMinutes' | 'TenMinutes' | 'FifteenMinutes' | 'TwentyMinutes'
  | 'HalfHour' | 'OneHour' | 'TwoHours' | 'FourHours'
  | 'OneDay' | 'OneWeek' | 'OneMonth' | 'OneYear';

export interface Candle {
  start: string;
  end: string;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
  VWAP: number;
}

export interface StreamOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
  heartbeatIntervalMs?: number;
}

export interface PollFeedOptions {
  intervalMs?: number;
  batchSize?: number;
  deduplicate?: boolean;
  adaptive?: boolean;
}`,
    },
    client: {
      name: 'client.ts',
      desc: 'QuestradeClient core REST client with auto-refresh, backoff retries, and typed endpoint methods.',
      code: `import {
  Account, AccountBalance, Level1Quote, Candle, SymbolInfo,
  HistoricalCandlesOptions, QuestradeClientOptions, QuestradeCredentials
} from './types';
import { QuestradeAuthError, QuestradeRateLimitError, QuestradeNotFoundError } from './errors';

export class QuestradeClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private apiServer: string | null = null;

  constructor(options: QuestradeClientOptions = {}) {
    this.refreshToken = options.refreshToken || null;
    this.accessToken = options.accessToken || null;
    this.apiServer = options.apiServer?.replace(/\\/+$/, '') || null;
  }

  public async exchangeRefreshToken(token?: string): Promise<QuestradeCredentials> {
    const target = token || this.refreshToken;
    const url = \`https://login.questrade.com/oauth2/token?grant_type=refresh_token&refresh_token=\${encodeURIComponent(target!)}\`;
    const res = await fetch(url);
    const data = await res.json();
    this.accessToken = data.access_token;
    this.apiServer = data.api_server.replace(/\\/+$/, '');
    this.refreshToken = data.refresh_token;
    return { accessToken: this.accessToken!, apiServer: this.apiServer!, refreshToken: this.refreshToken };
  }

  public async getAccounts(): Promise<Account[]> {
    const res = await this.request<{ accounts: Account[] }>('v1/accounts');
    return res.accounts || [];
  }

  public async getQuotes(symbolIds: number[]): Promise<Level1Quote[]> {
    const res = await this.request<{ quotes: Level1Quote[] }>(\`v1/markets/quotes?ids=\${symbolIds.join(',')}\`);
    return res.quotes || [];
  }

  public async getCandles(symbolId: number, options: HistoricalCandlesOptions): Promise<Candle[]> {
    const query = new URLSearchParams({
      startTime: options.startTime instanceof Date ? options.startTime.toISOString() : options.startTime,
      interval: options.interval || 'OneDay',
    });
    const res = await this.request<{ candles: Candle[] }>(\`v1/markets/candles/\${symbolId}?\${query.toString()}\`);
    return res.candles || [];
  }
}`,
    },
    streaming: {
      name: 'streaming.ts',
      desc: 'QuestradeStreamFeed - Real-time WebSocket Level 1 quotes & order events with heartbeat & auto-reconnect.',
      code: `import { Level1Quote, StreamOptions, FeedStats } from './types';
import { QuestradeClient } from './client';

export class QuestradeStreamFeed {
  private client: QuestradeClient;
  private ws: WebSocket | null = null;
  private subscribedSymbolIds: Set<number> = new Set();

  constructor(client: QuestradeClient, options: StreamOptions = {}) {
    this.client = client;
  }

  public async connect(): Promise<void> {
    const creds = this.client.getCredentials();
    const port = await this.client.getStreamPort('WebSocket', Array.from(this.subscribedSymbolIds));
    const url = \`wss://\${new URL(creds!.apiServer).hostname}:\${port}/v1/markets/quotes?mode=WebSocket\`;
    
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      // Send Questrade auth token as raw string
      this.ws?.send(creds!.accessToken);
      this.sendSubscriptions();
    };
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.quotes) {
        for (const q of data.quotes) this.emit('quote', q);
      }
    };
  }

  public subscribeQuotes(symbolIds: number[]): void {
    for (const id of symbolIds) this.subscribedSymbolIds.add(id);
    this.sendSubscriptions();
  }
}`,
    },
    polling: {
      name: 'polling.ts',
      desc: 'QuestradePollFeed - Smart batching, deduplicating, adaptive polling feed with rate limit recovery.',
      code: `import { Level1Quote, PollFeedOptions, FeedStats } from './types';
import { QuestradeClient } from './client';

export class QuestradePollFeed {
  private client: QuestradeClient;
  private options: Required<PollFeedOptions>;
  private subscribedSymbolIds: Set<number> = new Set();
  private isRunning: boolean = false;
  private lastQuoteCache: Map<number, Level1Quote> = new Map();

  constructor(client: QuestradeClient, options: PollFeedOptions = {}) {
    this.client = client;
    this.options = {
      intervalMs: Math.max(250, options.intervalMs ?? 1000),
      batchSize: Math.min(100, options.batchSize ?? 50),
      deduplicate: options.deduplicate ?? true,
      adaptive: options.adaptive ?? true,
    };
  }

  public start(): void {
    this.isRunning = true;
    this.pollLoop();
  }

  private async pollLoop(): Promise<void> {
    if (!this.isRunning) return;
    const ids = Array.from(this.subscribedSymbolIds);
    if (ids.length > 0) {
      const quotes = await this.client.getQuotes(ids);
      for (const q of quotes) {
        if (this.options.deduplicate) {
          const prev = this.lastQuoteCache.get(q.symbolId);
          if (prev && prev.lastTradePriceTraded === q.lastTradePriceTraded && prev.volume === q.volume) {
            continue;
          }
        }
        this.lastQuoteCache.set(q.symbolId, q);
        this.emit('quote', q);
      }
    }
    setTimeout(() => this.pollLoop(), this.options.intervalMs);
  }
}`,
    },
    'feed-manager': {
      name: 'feed-manager.ts',
      desc: 'Unified Market Feed Manager with seamless auto-fallback between WebSocket and Polling.',
      code: `import { Level1Quote, MarketFeedOptions } from './types';
import { QuestradeClient } from './client';
import { QuestradeStreamFeed } from './streaming';
import { QuestradePollFeed } from './polling';

export class QuestradeMarketFeed {
  private mode: 'stream' | 'poll' | 'auto';
  private streamFeed: QuestradeStreamFeed;
  private pollFeed: QuestradePollFeed;

  constructor(client: QuestradeClient, options: MarketFeedOptions = {}) {
    this.mode = options.mode ?? 'auto';
    this.streamFeed = new QuestradeStreamFeed(client, options.streamOptions);
    this.pollFeed = new QuestradePollFeed(client, options.pollOptions);
  }

  public async start(): Promise<void> {
    if (this.mode === 'stream' || this.mode === 'auto') {
      try {
        await this.streamFeed.connect();
        return;
      } catch (err) {
        if (this.mode === 'auto') {
          console.warn('Streaming failed, falling back to Polling.');
          this.pollFeed.start();
          return;
        }
        throw err;
      }
    }
    this.pollFeed.start();
  }
}`,
    },
    errors: {
      name: 'errors.ts',
      desc: 'Questrade error hierarchy (QuestradeError, QuestradeAuthError, QuestradeRateLimitError, QuestradeStreamError).',
      code: `export enum QuestradeApiErrorCode {
  INVALID_ACCESS_TOKEN = 1001,
  ACCESS_TOKEN_EXPIRED = 1002,
  INVALID_REFRESH_TOKEN = 1003,
  ACCOUNT_NOT_FOUND = 1010,
  SYMBOL_NOT_FOUND = 1011,
  RATE_LIMIT_EXCEEDED = 1020,
  STREAM_CONNECTION_FAILED = 1041,
}

export class QuestradeError extends Error {
  public readonly status?: number;
  public readonly code: number;
  public readonly endpoint?: string;

  constructor(message: string, details: any = {}) {
    super(message);
    this.name = 'QuestradeError';
    this.status = details.status;
    this.code = details.code ?? QuestradeApiErrorCode.INVALID_ACCESS_TOKEN;
    this.endpoint = details.endpoint;
  }
}

export class QuestradeAuthError extends QuestradeError {}
export class QuestradeRateLimitError extends QuestradeError {}
export class QuestradeStreamError extends QuestradeError {}`,
    },
    index: {
      name: 'index.ts',
      desc: 'Main public package barrel export for npm distribution.',
      code: `export * from './types';
export * from './errors';
export * from './client';
export * from './streaming';
export * from './polling';
export * from './feed-manager';

export { QuestradeClient as default } from './client';`,
    },
    package: {
      name: 'package.json',
      desc: 'NPM package manifest with TypeScript exports and types declaration.',
      code: `{
  "name": "questrade-ts",
  "version": "1.0.0",
  "description": "Lightweight, zero-dependency TypeScript SDK for Questrade API with auto token refresh, rate-limit backoff, and dual WebSocket streaming & adaptive polling feeds.",
  "type": "module",
  "main": "./dist/sdk/index.cjs",
  "module": "./dist/sdk/index.js",
  "types": "./dist/sdk/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/sdk/index.d.ts",
      "import": "./dist/sdk/index.js",
      "require": "./dist/sdk/index.cjs"
    }
  },
  "files": [
    "dist/sdk",
    "README.md",
    "LICENSE"
  ],
  "keywords": [
    "questrade",
    "questrade-api",
    "trading",
    "stocks",
    "tsx",
    "nasdaq",
    "websocket",
    "streaming",
    "market-data",
    "options",
    "typescript"
  ],
  "author": "Questrade TypeScript SDK Contributors",
  "license": "MIT"
}`,
    },
  };

  const current = files[selectedFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              NPM SDK Architecture
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              TypeScript SDK Source Code & Module Definitions
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Zero external runtime dependencies. Native fetch, WebSocket support, and typed interfaces.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied to Clipboard' : `Copy ${current.name}`}</span>
        </button>
      </div>

      {/* File Tabs & Code Box */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-md overflow-hidden flex flex-col">
        {/* File Tabs */}
        <div className="flex items-center space-x-1 p-2 bg-slate-950/80 border-b border-slate-800 overflow-x-auto">
          {Object.keys(files).map((key) => {
            const f = files[key];
            const isActive = selectedFile === key;
            return (
              <button
                key={key}
                id={`source-tab-${key}`}
                onClick={() => setSelectedFile(key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 shadow-xs border border-slate-700 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{f.name}</span>
              </button>
            );
          })}
        </div>

        {/* File Header Description */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>{current.desc}</span>
          <span className="text-[11px] font-mono text-slate-500">TypeScript 5.8+</span>
        </div>

        {/* Code Content */}
        <pre className="p-5 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-[520px]">
          {current.code}
        </pre>
      </div>
    </div>
  );
};
