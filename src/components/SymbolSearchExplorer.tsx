import React, { useState, useEffect } from 'react';
import {
  Search,
  TrendingUp,
  BarChart2,
  Calendar,
  Layers,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  DollarSign,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import {
  SymbolSearchResult,
  SymbolInfo,
  Level1Quote,
  Candle,
  HistoricalCandleInterval,
  OptionChainChainNode,
} from '../sdk/types.ts';
import { QuestradeClient } from '../sdk/client.ts';

interface SymbolSearchExplorerProps {
  client: QuestradeClient;
  mode: 'sandbox' | 'live';
}

export const SymbolSearchExplorer: React.FC<SymbolSearchExplorerProps> = ({ client, mode }) => {
  const [searchQuery, setSearchQuery] = useState('SHOP.TO');
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [selectedSymbolId, setSelectedSymbolId] = useState<number>(8049);
  const [symbolInfo, setSymbolInfo] = useState<SymbolInfo | null>(null);
  const [quote, setQuote] = useState<Level1Quote | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candleInterval, setCandleInterval] = useState<HistoricalCandleInterval>('OneDay');
  const [optionChains, setOptionChains] = useState<OptionChainChainNode[]>([]);
  const [viewMode, setViewMode] = useState<'chart' | 'options' | 'raw'>('chart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search symbols on query change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await client.searchSymbols(searchQuery.trim());
        setSearchResults(results);
      } catch (err: any) {
        console.warn('Search error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, client]);

  // Load symbol info, quote, candles, and option chain
  useEffect(() => {
    if (!selectedSymbolId) return;
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const past = new Date(now.getTime() - 86400000 * 45);

        const [info, q, c, opt] = await Promise.all([
          client.getSymbol(selectedSymbolId).catch(() => null),
          client.getQuote(selectedSymbolId).catch(() => null),
          client.getCandles(selectedSymbolId, {
            startTime: past,
            endTime: now,
            interval: candleInterval,
          }).catch(() => []),
          client.getOptionChain(selectedSymbolId).catch(() => []),
        ]);

        if (mounted) {
          setSymbolInfo(info);
          setQuote(q);
          setCandles(c);
          setOptionChains(opt);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load symbol details');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [selectedSymbolId, candleInterval, client]);

  // Render SVG Candlestick Chart
  const renderCandlestickChart = () => {
    if (candles.length === 0) {
      return <div className="text-center py-16 text-xs text-slate-400">No candle data available.</div>;
    }

    const minPrice = Math.min(...candles.map((c) => c.low)) * 0.995;
    const maxPrice = Math.max(...candles.map((c) => c.high)) * 1.005;
    const range = maxPrice - minPrice || 1;

    const svgWidth = 720;
    const svgHeight = 220;
    const padding = { top: 20, right: 50, bottom: 25, left: 10 };
    const chartW = svgWidth - padding.left - padding.right;
    const chartH = svgHeight - padding.top - padding.bottom;

    const candleWidth = Math.max(3, Math.min(16, (chartW / candles.length) * 0.65));

    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto font-mono text-[10px]">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padding.top + chartH * (1 - pct);
            const price = minPrice + range * pct;
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text x={padding.left + chartW + 6} y={y + 3} fill="#94a3b8" textAnchor="start">
                  ${price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Candles */}
          {candles.map((candle, idx) => {
            const isUp = candle.close >= candle.open;
            const x = padding.left + (idx + 0.5) * (chartW / candles.length);
            const yHigh = padding.top + chartH * (1 - (candle.high - minPrice) / range);
            const yLow = padding.top + chartH * (1 - (candle.low - minPrice) / range);
            const yOpen = padding.top + chartH * (1 - (candle.open - minPrice) / range);
            const yClose = padding.top + chartH * (1 - (candle.close - minPrice) / range);

            const bodyY = Math.min(yOpen, yClose);
            const bodyH = Math.max(2, Math.abs(yClose - yOpen));
            const color = isUp ? '#10b981' : '#f43f5e';

            return (
              <g key={idx} className="hover:opacity-80 transition-opacity">
                {/* Wick */}
                <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.5" />
                {/* Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyH}
                  fill={isUp ? '#10b981' : '#f43f5e'}
                  rx="1"
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Market Data
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Symbol Search, Quotes & Historical Candles
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Lookup any Canadian (TSX) or US ticker, inspect Level 1 market depth, and retrieve OHLCV intervals.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="symbol-search-input"
              type="text"
              placeholder="Search ticker or company (e.g. SHOP.TO, AAPL)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
            />

            {/* Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((res) => (
                  <button
                    key={res.symbolId}
                    type="button"
                    onClick={() => {
                      setSelectedSymbolId(res.symbolId);
                      setSearchResults([]);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-purple-50 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900 font-mono mr-2">{res.symbol}</span>
                      <span className="text-slate-500 truncate">{res.description}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {res.listingExchange}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected Symbol Overview */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base font-mono">
              {symbolInfo?.symbol?.split('.')[0] || 'SYM'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg font-mono tracking-tight">
                  {symbolInfo?.symbol || 'SHOP.TO'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                  {symbolInfo?.listingExchange || 'TSX'}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                  {symbolInfo?.currency || 'CAD'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {symbolInfo?.description || 'Shopify Inc. Subordinate Voting Shares'} • {symbolInfo?.industrySector || 'Technology'}
              </p>
            </div>
          </div>

          {/* Real-Time Snap Quote Box */}
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                Last Price
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono">
                ${quote?.lastTradePriceTraded?.toFixed(2) ?? '135.50'}
              </div>
            </div>

            <div className="border-l border-slate-200 pl-3">
              <div className="text-[10px] text-slate-500 font-medium">Bid / Ask</div>
              <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
                ${quote?.bidPrice?.toFixed(2) ?? '135.45'} / ${quote?.askPrice?.toFixed(2) ?? '135.55'}
              </div>
            </div>

            <div className="border-l border-slate-200 pl-3">
              <div className="text-[10px] text-slate-500 font-medium">Day Volume</div>
              <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
                {(quote?.volume ?? 450200).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Fundamental & Technical Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">52W Range</div>
            <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
              ${symbolInfo?.lowPrice52?.toFixed(2) || '75.00'} - ${symbolInfo?.highPrice52?.toFixed(2) || '142.00'}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">P/E Ratio</div>
            <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
              {symbolInfo?.pe ? symbolInfo.pe.toFixed(1) : '28.5'}x
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Dividend Yield</div>
            <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
              {symbolInfo?.yield ? `${symbolInfo.yield.toFixed(2)}%` : '0.00%'}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Min Tick</div>
            <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
              ${symbolInfo?.minTick || '0.01'}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">3M Avg Vol</div>
            <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
              {(symbolInfo?.averageVol3Months || 1200000).toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Tradable</div>
            <div className="text-xs font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
              <span>Yes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart and Options Inspector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-1">
            <button
              id="tab-candlestick-chart"
              type="button"
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'chart'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Historical Candles ({candles.length})</span>
            </button>

            <button
              id="tab-option-chain"
              type="button"
              onClick={() => setViewMode('options')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'options'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Option Chain</span>
            </button>

            <button
              id="tab-raw-json"
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'raw'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Raw JSON</span>
            </button>
          </div>

          {/* Timeframe Interval Filter (for chart) */}
          {viewMode === 'chart' && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {(['OneMinute', 'FiveMinutes', 'FifteenMinutes', 'OneHour', 'OneDay'] as HistoricalCandleInterval[]).map(
                (intv) => {
                  const labelMap: Record<string, string> = {
                    OneMinute: '1m',
                    FiveMinutes: '5m',
                    FifteenMinutes: '15m',
                    OneHour: '1h',
                    OneDay: '1D',
                  };
                  return (
                    <button
                      key={intv}
                      type="button"
                      onClick={() => setCandleInterval(intv)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                        candleInterval === intv ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {labelMap[intv]}
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              <span>Retrieving market candle series...</span>
            </div>
          ) : viewMode === 'chart' ? (
            renderCandlestickChart()
          ) : viewMode === 'options' ? (
            optionChains.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No option chains available for this symbol.
              </div>
            ) : (
              <div className="space-y-4">
                {optionChains.map((node, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{node.description}</span>
                        <span className="text-slate-500 ml-2">
                          Expiry: {new Date(node.expiryDate).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-medium">
                        {node.optionExerciseType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {node.chainPerRoot[0]?.strikePrices.map((strike) => (
                        <div key={strike} className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold">Strike Price</div>
                          <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">${strike.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-96">
              {JSON.stringify({ symbolInfo, quote, candlesCount: candles.length, optionChains }, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
