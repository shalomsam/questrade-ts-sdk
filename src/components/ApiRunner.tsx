import React, { useState } from 'react';
import {
  Play,
  Copy,
  Check,
  Clock,
  Code2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Zap,
} from 'lucide-react';
import { QuestradeClient } from '../sdk/client.ts';

interface ApiRunnerProps {
  client: QuestradeClient;
  mode: 'sandbox' | 'live';
}

interface ApiEndpointDef {
  id: string;
  name: string;
  category: 'Accounts' | 'Market Data' | 'Symbols' | 'System';
  description: string;
  methodName: string;
  defaultParams: Record<string, any>;
  execute: (client: QuestradeClient, params: any) => Promise<any>;
  generateSnippet: (params: any) => string;
}

export const ApiRunner: React.FC<ApiRunnerProps> = ({ client, mode }) => {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('getQuotes');
  const [params, setParams] = useState<Record<string, any>>({ symbolIds: '8049, 9291, 12049' });
  const [response, setResponse] = useState<any>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const endpoints: ApiEndpointDef[] = [
    {
      id: 'getQuotes',
      name: 'client.getQuotes(symbolIds)',
      category: 'Market Data',
      description: 'Fetch Level 1 snap quotes for multiple symbol IDs in a single batch request.',
      methodName: 'getQuotes',
      defaultParams: { symbolIds: '8049, 9291, 12049' },
      execute: async (c, p) => {
        const ids = p.symbolIds
          .split(',')
          .map((s: string) => parseInt(s.trim(), 10))
          .filter((n: number) => !isNaN(n));
        return await c.getQuotes(ids);
      },
      generateSnippet: (p) => `import { QuestradeClient } from 'questrade-ts';

const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
});

// Fetch batch Level 1 quotes
const quotes = await client.getQuotes([${p.symbolIds}]);
console.log('Quotes:', quotes);`,
    },
    {
      id: 'getAccounts',
      name: 'client.getAccounts()',
      category: 'Accounts',
      description: 'Retrieve all brokerage accounts associated with user profile.',
      methodName: 'getAccounts',
      defaultParams: {},
      execute: async (c) => await c.getAccounts(),
      generateSnippet: () => `import { QuestradeClient } from 'questrade-ts';

const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
});

const accounts = await client.getAccounts();
for (const acc of accounts) {
  console.log(\`Account \${acc.number} (\${acc.type}) - \${acc.status}\`);
}`,
    },
    {
      id: 'getPositions',
      name: 'client.getPositions(accountId)',
      category: 'Accounts',
      description: 'Fetch open stock, option, and ETF positions for a given account.',
      methodName: 'getPositions',
      defaultParams: { accountId: '28491028' },
      execute: async (c, p) => await c.getPositions(p.accountId),
      generateSnippet: (p) => `import { QuestradeClient } from 'questrade-ts';

const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
});

const positions = await client.getPositions('${p.accountId}');
console.log('Positions:', positions);`,
    },
    {
      id: 'getBalances',
      name: 'client.getBalances(accountId)',
      category: 'Accounts',
      description: 'Fetch cash, market value, equity, and buying power per currency.',
      methodName: 'getBalances',
      defaultParams: { accountId: '28491028' },
      execute: async (c, p) => await c.getBalances(p.accountId),
      generateSnippet: (p) => `import { QuestradeClient } from 'questrade-ts';

const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
});

const balances = await client.getBalances('${p.accountId}');
console.log('Total CAD Equity:', balances.combinedBalances[0]?.totalEquity);`,
    },
    {
      id: 'searchSymbols',
      name: 'client.searchSymbols(prefix)',
      category: 'Symbols',
      description: 'Prefix search across TSX, NASDAQ, and NYSE equities.',
      methodName: 'searchSymbols',
      defaultParams: { prefix: 'SHOP' },
      execute: async (c, p) => await c.searchSymbols(p.prefix),
      generateSnippet: (p) => `import { QuestradeClient } from 'questrade-ts';

const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
});

const symbols = await client.searchSymbols('${p.prefix}');
console.log('Search matches:', symbols);`,
    },
    {
      id: 'getCandles',
      name: 'client.getCandles(symbolId, options)',
      category: 'Market Data',
      description: 'Retrieve historical OHLCV candlestick time series with custom intervals.',
      methodName: 'getCandles',
      defaultParams: { symbolId: 8049, interval: 'OneDay' },
      execute: async (c, p) => {
        const now = new Date();
        const past = new Date(now.getTime() - 86400000 * 30);
        return await c.getCandles(Number(p.symbolId), {
          startTime: past,
          endTime: now,
          interval: p.interval || 'OneDay',
        });
      },
      generateSnippet: (p) => `import { QuestradeClient } from 'questrade-ts';

const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
});

const candles = await client.getCandles(${p.symbolId}, {
  startTime: new Date(Date.now() - 30 * 86400000),
  endTime: new Date(),
  interval: '${p.interval || 'OneDay'}',
});
console.log('Candles:', candles);`,
    },
    {
      id: 'getServerTime',
      name: 'client.getServerTime()',
      category: 'System',
      description: 'Fetch synchronized Questrade server timestamp in ISO-8601.',
      methodName: 'getServerTime',
      defaultParams: {},
      execute: async (c) => await c.getServerTime(),
      generateSnippet: () => `import { QuestradeClient } from 'questrade-ts';

const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
});

const serverTime = await client.getServerTime();
console.log('Questrade Server Time:', serverTime);`,
    },
  ];

  const currentDef = endpoints.find((e) => e.id === selectedEndpointId) || endpoints[0];

  const handleSelectEndpoint = (endpoint: ApiEndpointDef) => {
    setSelectedEndpointId(endpoint.id);
    setParams(endpoint.defaultParams);
    setResponse(null);
    setError(null);
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await currentDef.execute(client, params);
      setLatencyMs(Math.round(performance.now() - start));
      setResponse(res);
    } catch (err: any) {
      setLatencyMs(Math.round(performance.now() - start));
      setError(err.toDiagnosticString ? err.toDiagnosticString() : err.message || 'Execution error');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(currentDef.generateSnippet(params));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Interactive SDK Runner
          </span>
          <h2 className="text-base font-semibold text-slate-900">
            API Playground & Code Generator
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Execute any Questrade client method in real-time, view full JSON payload responses, and copy ready-to-run TypeScript snippets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Method Picker (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Available SDK Methods
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {endpoints.map((ep) => {
              const isSelected = ep.id === selectedEndpointId;
              return (
                <button
                  key={ep.id}
                  id={`api-endpoint-${ep.id}`}
                  onClick={() => handleSelectEndpoint(ep)}
                  className={`w-full p-3 text-left transition-colors flex items-start justify-between ${
                    isSelected ? 'bg-emerald-50/70 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-mono font-semibold ${isSelected ? 'text-emerald-900' : 'text-slate-900'}`}>
                        {ep.methodName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{ep.description}</p>
                  </div>
                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {ep.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Parameters, Execution & Output (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Method Execution Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono">{currentDef.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{currentDef.description}</p>
              </div>

              <button
                id="run-api-method-btn"
                type="button"
                onClick={handleExecute}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute Method</span>
                  </>
                )}
              </button>
            </div>

            {/* Dynamic Parameter Inputs */}
            {Object.keys(currentDef.defaultParams).length > 0 && (
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700">Method Parameters</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.keys(currentDef.defaultParams).map((key) => (
                    <div key={key}>
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">{key}</label>
                      <input
                        type="text"
                        value={params[key] ?? ''}
                        onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Response Diagnostics Bar */}
            {latencyMs !== null && (
              <div className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-slate-100 text-slate-700">
                <div className="flex items-center gap-1.5 font-medium">
                  {error ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Status: {error ? 'Failed' : '200 OK'}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{latencyMs} ms</span>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-mono">
                {error}
              </div>
            )}

            {/* JSON Response Viewer */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Response Payload (JSON)</span>
                {response && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(response, null, 2))}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy JSON</span>
                  </button>
                )}
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-72 shadow-inner">
                {response
                  ? JSON.stringify(response, null, 2)
                  : loading
                  ? '// Waiting for API execution...'
                  : '// Click "Execute Method" above to test this API call.'}
              </pre>
            </div>
          </div>

          {/* Generated TypeScript Code Snippet */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>TypeScript Usage Code</span>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="text-xs font-mono text-emerald-300 overflow-x-auto p-2 bg-slate-950/50 rounded-lg">
              {currentDef.generateSnippet(params)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
