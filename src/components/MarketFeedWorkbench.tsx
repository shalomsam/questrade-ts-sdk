import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Activity,
  Zap,
  RefreshCw,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Layers,
  Clock,
  Terminal,
} from 'lucide-react';
import { Level1Quote, FeedStats } from '../sdk/types.ts';
import { QuestradeClient } from '../sdk/client.ts';
import { QuestradeStreamFeed } from '../sdk/streaming.ts';
import { QuestradePollFeed } from '../sdk/polling.ts';

interface MarketFeedWorkbenchProps {
  client: QuestradeClient;
  mode: 'sandbox' | 'live';
}

interface SymbolMeta {
  id: number;
  symbol: string;
  name: string;
  currency: 'CAD' | 'USD';
}

const DEFAULT_SYMBOLS: SymbolMeta[] = [
  { id: 8049, symbol: 'SHOP.TO', name: 'Shopify Inc.', currency: 'CAD' },
  { id: 9291, symbol: 'RY.TO', name: 'Royal Bank of Canada', currency: 'CAD' },
  { id: 4129, symbol: 'TD.TO', name: 'Toronto-Dominion Bank', currency: 'CAD' },
  { id: 12049, symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD' },
  { id: 16840, symbol: 'NVDA', name: 'NVIDIA Corporation', currency: 'USD' },
  { id: 18491, symbol: 'TSLA', name: 'Tesla Inc.', currency: 'USD' },
];

export const MarketFeedWorkbench: React.FC<MarketFeedWorkbenchProps> = ({ client, mode }) => {
  const [engineType, setEngineType] = useState<'stream' | 'poll'>('stream');
  const [activeSymbols, setActiveSymbols] = useState<SymbolMeta[]>(DEFAULT_SYMBOLS);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [quotes, setQuotes] = useState<Map<number, Level1Quote>>(new Map());
  const [priceDeltas, setPriceDeltas] = useState<Map<number, 'up' | 'down' | 'same'>>(new Map());
  const [tickLogs, setTickLogs] = useState<Array<{ id: string; time: string; symbol: string; price: number; tick: string; size: number; bid: number; ask: number }>>([]);
  const [pollInterval, setPollInterval] = useState<number>(1000);
  const [deduplicate, setDeduplicate] = useState<boolean>(true);
  const [stats, setStats] = useState<FeedStats>({
    mode: 'stream',
    subscribedCount: 0,
    totalTicksReceived: 0,
    ticksPerSecond: 0,
    lastTickTimestamp: null,
    connectionState: 'connecting',
    latencyMs: 0,
    errorCount: 0,
  });

  const streamFeedRef = useRef<QuestradeStreamFeed | null>(null);
  const pollFeedRef = useRef<QuestradePollFeed | null>(null);

  // Initialize and switch feed engines
  useEffect(() => {
    // Teardown existing feeds
    if (streamFeedRef.current) {
      streamFeedRef.current.disconnect();
      streamFeedRef.current = null;
    }
    if (pollFeedRef.current) {
      pollFeedRef.current.stop();
      pollFeedRef.current = null;
    }

    const symbolIds = activeSymbols.map((s) => s.id);

    const handleQuote = (quote: Level1Quote) => {
      setQuotes((prev: Map<number, Level1Quote>) => {
        const next = new Map<number, Level1Quote>(prev);
        const oldQuote: Level1Quote | undefined = next.get(quote.symbolId);

        let delta: 'up' | 'down' | 'same' = 'same';
        if (oldQuote && oldQuote.lastTradePriceTraded !== null && quote.lastTradePriceTraded !== null) {
          if (quote.lastTradePriceTraded > oldQuote.lastTradePriceTraded) delta = 'up';
          else if (quote.lastTradePriceTraded < oldQuote.lastTradePriceTraded) delta = 'down';
        }

        setPriceDeltas((dPrev: Map<number, 'up' | 'down' | 'same'>) => new Map(dPrev).set(quote.symbolId, delta));

        // Clear delta flash after 600ms
        setTimeout(() => {
          setPriceDeltas((dPrev: Map<number, 'up' | 'down' | 'same'>) => {
            const copy = new Map(dPrev);
            copy.delete(quote.symbolId);
            return copy;
          });
        }, 600);

        next.set(quote.symbolId, quote);
        return next;
      });

      // Add to tick log (limit 25)
      setTickLogs((prev) => [
        {
          id: `${quote.symbolId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          time: new Date().toLocaleTimeString(),
          symbol: quote.symbol,
          price: quote.lastTradePriceTraded || 0,
          tick: quote.lastTradeTick || 'Equal',
          size: quote.lastTradeSize || 100,
          bid: quote.bidPrice || 0,
          ask: quote.askPrice || 0,
        },
        ...prev.slice(0, 24),
      ]);
    };

    const handleStats = (newStats: FeedStats) => {
      setStats(newStats);
    };

    if (engineType === 'stream') {
      const feed = new QuestradeStreamFeed(client, {
        autoReconnect: true,
        reconnectDelayMs: 1000,
      });
      streamFeedRef.current = feed;

      feed.on('quote', handleQuote);
      feed.on('stats', handleStats);
      feed.on('error', (err) => console.warn('[StreamFeed error]', err));

      feed.subscribeQuotes(symbolIds);
      feed.connect();
    } else {
      const feed = new QuestradePollFeed(client, {
        intervalMs: pollInterval,
        batchSize: 50,
        deduplicate: deduplicate,
      });
      pollFeedRef.current = feed;

      feed.on('quote', handleQuote);
      feed.on('stats', handleStats);
      feed.on('error', (err) => console.warn('[PollFeed error]', err));

      feed.subscribeQuotes(symbolIds);
      feed.start();
    }

    return () => {
      if (streamFeedRef.current) streamFeedRef.current.disconnect();
      if (pollFeedRef.current) pollFeedRef.current.stop();
    };
  }, [engineType, pollInterval, deduplicate, activeSymbols, client]);

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbolInput.trim().toUpperCase();
    if (!sym) return;

    // Check if already in list
    if (activeSymbols.some((s) => s.symbol.toUpperCase() === sym)) {
      setNewSymbolInput('');
      return;
    }

    const newId = Math.floor(Math.random() * 80000 + 20000);
    const newEntry: SymbolMeta = {
      id: newId,
      symbol: sym,
      name: sym.endsWith('.TO') ? `${sym} Equities` : `${sym} Stock`,
      currency: sym.endsWith('.TO') ? 'CAD' : 'USD',
    };

    setActiveSymbols([...activeSymbols, newEntry]);
    setNewSymbolInput('');
  };

  const handleRemoveSymbol = (symbolId: number) => {
    setActiveSymbols(activeSymbols.filter((s) => s.id !== symbolId));
    setQuotes((prev) => {
      const next = new Map(prev);
      next.delete(symbolId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Control Strip & Engine Selector */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Feed Engine
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Level 1 Real-Time Market Data Workbench
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Switch seamlessly between high-throughput WebSocket streaming and batch-optimized polling feeds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Engine Segmented Switch */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200">
              <button
                id="engine-stream-btn"
                type="button"
                onClick={() => setEngineType('stream')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  engineType === 'stream'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>WebSocket Stream</span>
              </button>

              <button
                id="engine-poll-btn"
                type="button"
                onClick={() => setEngineType('poll')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  engineType === 'poll'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Batch Polling Feed</span>
              </button>
            </div>

            {/* Polling Options (if polling active) */}
            {engineType === 'poll' && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-600 font-medium">Interval:</span>
                <select
                  id="poll-interval-select"
                  value={pollInterval}
                  onChange={(e) => setPollInterval(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 focus:outline-hidden"
                >
                  <option value={250}>250 ms (Ultra)</option>
                  <option value={500}>500 ms (Fast)</option>
                  <option value={1000}>1,000 ms (Standard)</option>
                  <option value={2000}>2,000 ms (Eco)</option>
                  <option value={5000}>5,000 ms (Low Rate)</option>
                </select>

                <label className="flex items-center gap-1 cursor-pointer ml-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={deduplicate}
                    onChange={(e) => setDeduplicate(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0"
                  />
                  <span>Deduplicate</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Live Diagnostics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Connection State</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  stats.connectionState === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : stats.connectionState === 'reconnecting'
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-xs font-semibold text-slate-800 capitalize">
                {stats.connectionState}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>Throughput</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-800">
              {stats.ticksPerSecond} <span className="text-[10px] font-normal text-slate-500">ticks/sec</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              <span>Total Ticks</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-800 font-mono">
              {stats.totalTicksReceived.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>Feed Latency</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-800">
              {stats.latencyMs} <span className="text-[10px] font-normal text-slate-500">ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Quote Cards + Stream Event Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tickers Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Subscribed Tickers ({activeSymbols.length})
              </h3>
            </div>

            {/* Add symbol form */}
            <form onSubmit={handleAddSymbol} className="flex items-center gap-1.5">
              <input
                id="add-ticker-input"
                type="text"
                placeholder="e.g. AMZN or BMO.TO"
                value={newSymbolInput}
                onChange={(e) => setNewSymbolInput(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 uppercase font-mono w-36"
              />
              <button
                id="add-ticker-btn"
                type="submit"
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeSymbols.map((item) => {
              const quote = quotes.get(item.id);
              const delta = priceDeltas.get(item.id);

              const price = quote?.lastTradePriceTraded ?? 0;
              const open = quote?.openPrice ?? price;
              const dayChange = price - open;
              const dayChangePct = open > 0 ? (dayChange / open) * 100 : 0;
              const isPositive = dayChange >= 0;

              const bid = quote?.bidPrice ?? 0;
              const ask = quote?.askPrice ?? 0;
              const spread = Math.max(0, ask - bid);
              const spreadBps = bid > 0 ? ((spread / bid) * 10000).toFixed(1) : '0';

              return (
                <div
                  key={item.id}
                  id={`quote-card-${item.symbol.replace('.', '-')}`}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    delta === 'up'
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-md shadow-emerald-500/10'
                      : delta === 'down'
                      ? 'bg-rose-50/80 border-rose-300 shadow-md shadow-rose-500/10'
                      : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-sm tracking-tight">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.currency}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {item.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[170px]">
                        {item.name}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSymbol(item.id)}
                      title="Unsubscribe symbol"
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Price & Change Display */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-1">
                      <span>${price.toFixed(2)}</span>
                      {delta === 'up' && (
                        <ArrowUpRight className="w-4 h-4 text-emerald-600 animate-bounce" />
                      )}
                      {delta === 'down' && (
                        <ArrowDownRight className="w-4 h-4 text-rose-600 animate-bounce" />
                      )}
                    </div>

                    <div
                      className={`text-xs font-semibold flex items-center gap-0.5 ${
                        isPositive ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {dayChange.toFixed(2)} ({isPositive ? '+' : ''}
                      {dayChangePct.toFixed(2)}%)
                    </div>
                  </div>

                  {/* Level 1 Depth / Spread */}
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Bid / Size
                      </div>
                      <div className="font-mono text-slate-900 font-medium mt-0.5">
                        ${bid.toFixed(2)}{' '}
                        <span className="text-[11px] text-slate-500 font-normal">
                          x{quote?.bidSize ?? 100}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Ask / Size
                      </div>
                      <div className="font-mono text-slate-900 font-medium mt-0.5">
                        ${ask.toFixed(2)}{' '}
                        <span className="text-[11px] text-slate-500 font-normal">
                          x{quote?.askSize ?? 100}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Stats: Spread & Volume */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      Spread: <span className="font-mono font-medium text-slate-700">${spread.toFixed(2)}</span>{' '}
                      <span className="text-slate-400">({spreadBps} bps)</span>
                    </div>
                    <div>
                      Vol: <span className="font-mono font-medium text-slate-700">{(quote?.volume ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Live Push Event Stream Terminal */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Live Feed Stream ({tickLogs.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setTickLogs([])}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear Log
            </button>
          </div>

          <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 border border-slate-800 font-mono text-xs shadow-inner h-[480px] flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span>TIME</span>
              <span>SYMBOL</span>
              <span>PRICE</span>
              <span>BID / ASK</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {tickLogs.length === 0 ? (
                <div className="text-slate-500 text-center py-16">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 opacity-50" />
                  <span>Waiting for incoming ticks...</span>
                </div>
              ) : (
                tickLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-[11px] py-0.5 hover:bg-slate-800/60 px-1 rounded transition-colors"
                  >
                    <span className="text-slate-500 text-[10px]">{log.time}</span>
                    <span className="font-semibold text-emerald-400">{log.symbol}</span>
                    <span
                      className={`font-semibold ${
                        log.tick === 'Up'
                          ? 'text-emerald-400'
                          : log.tick === 'Down'
                          ? 'text-rose-400'
                          : 'text-slate-200'
                      }`}
                    >
                      ${log.price.toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {log.bid.toFixed(2)} / {log.ask.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>ENGINE: {engineType.toUpperCase()}</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
