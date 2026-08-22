import React, { useState } from 'react';
import { Terminal, Copy, Check, Play, BookOpen, Layers, ArrowRight, FileCode, CheckCircle2 } from 'lucide-react';

interface ExampleItem {
  id: string;
  file: string;
  command: string;
  title: string;
  description: string;
  category: 'Auth' | 'Portfolio' | 'Market Data' | 'Streaming' | 'Orders' | 'Options';
  code: string;
}

const EXAMPLES: ExampleItem[] = [
  {
    id: 'auth',
    file: 'examples/01-basic-authentication.ts',
    command: 'npx tsx examples/01-basic-authentication.ts',
    title: '01: Basic Authentication & Auto-Renewal',
    category: 'Auth',
    description: 'Initializes QuestradeClient, exchanges manual refresh token for live access credentials, handles the onTokenRefresh persistence callback, and queries server time.',
    code: `import { QuestradeClient, QuestradeAuthError } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    autoRefresh: true,
    onTokenRefresh: async (credentials) => {
      console.log('🔄 Token Refreshed:', credentials.refreshToken);
      // Persist credentials.refreshToken to your secret manager / DB
    },
  });

  // Verify authentication & get server time
  const serverTime = await client.getServerTime();
  console.log('Questrade Server Time:', serverTime);
}

main().catch(console.error);`,
  },
  {
    id: 'portfolio',
    file: 'examples/02-account-portfolio.ts',
    command: 'npx tsx examples/02-account-portfolio.ts',
    title: '02: Account Discovery & Positions',
    category: 'Portfolio',
    description: 'Discovers active TFSA, Margin, RRSP, and FHSA accounts. Queries CAD & USD cash balances, buying power, total equity, and open positions with unrealized P&L.',
    code: `import { QuestradeClient } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });

  const accounts = await client.getAccounts();
  for (const acc of accounts) {
    console.log(\`Account: \${acc.type} (#\${acc.number})\`);
    
    // Balances
    const balances = await client.getBalances(acc.number);
    console.log('Combined Equity:', balances.combinedBalances[0]?.totalEquity);

    // Open Positions
    const positions = await client.getPositions(acc.number);
    console.table(positions.map(p => ({
      Symbol: p.symbol,
      Qty: p.openQuantity,
      AvgPrice: p.averageEntryPrice,
      CurrentPrice: p.currentPrice,
      OpenPnL: p.openPnl
    })));
  }
}

main().catch(console.error);`,
  },
  {
    id: 'quotes',
    file: 'examples/03-market-quotes-candles.ts',
    command: 'npx tsx examples/03-market-quotes-candles.ts',
    title: '03: Quotes & Candlestick Histories',
    category: 'Market Data',
    description: 'Searches symbols with ticker prefix, fetches Level 1 snap quotes for single & batch symbol IDs, and downloads historical OHLCV bars.',
    code: `import { QuestradeClient } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });

  // 1. Search symbol
  const search = await client.searchSymbols('SHOP');
  const target = search[0]; // SHOP.TO (ID: 8049)

  // 2. Fetch single quote
  const quote = await client.getQuote(target.symbolId);
  console.log(\`\${quote.symbol}: Bid $\${quote.bidPrice} / Ask $\${quote.askPrice}\`);

  // 3. Batch quotes
  const batch = await client.getQuotes([8049, 9291, 12049]);
  console.log(\`Fetched \${batch.length} quotes in 1 request\`);

  // 4. Historical daily candles
  const candles = await client.getCandles(target.symbolId, {
    startTime: new Date(Date.now() - 14 * 86400000),
    interval: 'OneDay',
  });
  console.log(\`Retrieved \${candles.length} OHLCV candles\`);
}

main().catch(console.error);`,
  },
  {
    id: 'stream',
    file: 'examples/04-websocket-streaming.ts',
    command: 'npx tsx examples/04-websocket-streaming.ts',
    title: '04: Real-Time WebSocket Streaming',
    category: 'Streaming',
    description: 'Subscribes to Questrade WebSocket stream port for low-latency Level 1 push updates and order execution notifications with heartbeat management.',
    code: `import { QuestradeClient, QuestradeStreamFeed } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
  const stream = new QuestradeStreamFeed(client, {
    autoReconnect: true,
    heartbeatIntervalMs: 30000,
  });

  stream.on('quote', (quote) => {
    console.log(\`⚡ [TICK] \${quote.symbol}: $\${quote.lastTradePriceTraded} (Vol: \${quote.volume})\`);
  });

  stream.on('order', (order) => {
    console.log(\`📋 [ORDER] #\${order.id} \${order.symbol}: \${order.state}\`);
  });

  await stream.connect();
  stream.subscribe([8049, 9291, 12049]); // SHOP.TO, RY.TO, AAPL
}

main().catch(console.error);`,
  },
  {
    id: 'poll',
    file: 'examples/05-batch-polling-feed.ts',
    command: 'npx tsx examples/05-batch-polling-feed.ts',
    title: '05: High-Throughput Batch Polling',
    category: 'Market Data',
    description: 'Demonstrates batch HTTP polling up to 100 tickers per round-trip with intelligent tick deduplication to filter out redundant events.',
    code: `import { QuestradeClient, QuestradePollFeed } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
  const pollFeed = new QuestradePollFeed(client, {
    intervalMs: 1000,
    batchSize: 50,
    deduplicate: true, // Only emits quote event if price/spread/volume changed
    adaptive: true,
  });

  pollFeed.on('quote', (quote) => {
    console.log(\`🔔 [DEDUP TICK] \${quote.symbol}: $\${quote.lastTradePriceTraded}\`);
  });

  pollFeed.subscribe([8049, 9291, 4129, 12049]);
  pollFeed.start();
}

main().catch(console.error);`,
  },
  {
    id: 'hybrid',
    file: 'examples/06-hybrid-market-feed.ts',
    command: 'npx tsx examples/06-hybrid-market-feed.ts',
    title: '06: Hybrid Feed with Auto-Fallback',
    category: 'Streaming',
    description: 'Unified market feed that starts with real-time WebSocket streaming and gracefully fails over to adaptive polling if WebSocket connection is firewalled.',
    code: `import { QuestradeClient, QuestradeMarketFeed } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
  const feed = new QuestradeMarketFeed(client, { mode: 'auto' });

  feed.on('quote', (quote) => {
    console.log(\`✨ [\${feed.getStats().mode}] \${quote.symbol}: $\${quote.lastTradePriceTraded}\`);
  });

  feed.on('modeChange', (newMode, reason) => {
    console.log(\`🔀 Mode changed to: \${newMode} (\${reason})\`);
  });

  await feed.start();
  feed.subscribe([8049, 9291]);
}

main().catch(console.error);`,
  },
  {
    id: 'options',
    file: 'examples/07-options-chains.ts',
    command: 'npx tsx examples/07-options-chains.ts',
    title: '07: Options Chains & Quotes',
    category: 'Options',
    description: 'Queries full options chains for an underlying equity, inspects expiration cycles & strikes, and retrieves Level 1 quotes for filtered strike ranges.',
    code: `import { QuestradeClient } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
  const underlyingId = 8049; // SHOP.TO

  // 1. Get option chains
  const chains = await client.getOptionChain(underlyingId);
  console.log('Available Expiration Cycles:', chains.length);

  // 2. Fetch specific option contract quotes
  const quotes = await client.getOptionQuotes([
    {
      underlyingId,
      expiryDate: chains[0].expiryDate,
      minstrikePrice: 120,
      maxstrikePrice: 150,
    }
  ]);
  console.table(quotes);
}

main().catch(console.error);`,
  },
  {
    id: 'orders',
    file: 'examples/08-order-lifecycle.ts',
    command: 'npx tsx examples/08-order-lifecycle.ts',
    title: '08: Complete Order Lifecycle',
    category: 'Orders',
    description: 'Pre-trade impact validation (testOrder), submitting limit/market orders, inspecting active orders, modifying price/quantity, and canceling orders.',
    code: `import { QuestradeClient } from 'questrade-ts-sdk';

async function main() {
  const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
  const accounts = await client.getAccounts();
  const accNum = accounts[0].number;

  // 1. Pre-trade impact calculation (Test Order)
  const impact = await client.testOrder(accNum, {
    symbolId: 8049,
    quantity: 10,
    limitPrice: 125.00,
    orderType: 'Limit',
    timeInForce: 'Day',
    action: 'Buy',
  });
  console.log('Est. Commission:', impact.commission);

  // 2. Place Order
  const placed = await client.placeOrder(accNum, {
    symbolId: 8049,
    quantity: 10,
    limitPrice: 125.00,
    orderType: 'Limit',
    timeInForce: 'Day',
    action: 'Buy',
  });
  console.log('Order Submitted ID:', placed.orderId);

  // 3. Modify Price
  await client.replaceOrder(accNum, placed.orderId, {
    limitPrice: 126.00,
    quantity: 10,
  });

  // 4. Cancel Order
  await client.cancelOrder(accNum, placed.orderId);
}

main().catch(console.error);`,
  },
];

export const ExamplesExplorer: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState<ExampleItem>(EXAMPLES[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Terminal className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">TypeScript Examples & NPM Package</h2>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded">
                8 Ready-to-Run Scripts
              </span>
            </div>
            <p className="text-sm text-slate-600">
              The SDK includes an <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs">examples/</code> folder with runnable scripts covering authentication, streaming, accounts, orders, and options.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => copyText('npm-install', 'npm install questrade-ts-sdk')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition-colors flex items-center gap-2 shadow-xs"
            >
              {copiedId === 'npm-install' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>npm install questrade-ts-sdk</span>
            </button>
            <button
              onClick={() => copyText('build-sdk', 'npm run build:sdk')}
              className="px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {copiedId === 'build-sdk' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Layers className="w-3.5 h-3.5" />}
              <span>npm run build:sdk</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Selector on Left, Code Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: List of examples */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">Example Catalog</h3>
          <div className="space-y-1.5">
            {EXAMPLES.map((ex) => {
              const isSelected = selectedExample.id === ex.id;
              return (
                <button
                  key={ex.id}
                  onClick={() => setSelectedExample(ex)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-900 line-clamp-1">{ex.title}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      ex.category === 'Streaming' ? 'bg-indigo-100 text-indigo-700' :
                      ex.category === 'Orders' ? 'bg-amber-100 text-amber-800' :
                      ex.category === 'Options' ? 'bg-purple-100 text-purple-700' :
                      ex.category === 'Portfolio' ? 'bg-blue-100 text-blue-700' :
                      ex.category === 'Auth' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {ex.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{ex.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Selected Example Detail */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900">{selectedExample.title}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{selectedExample.file}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyText('runner-cmd', selectedExample.command)}
                  className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-mono transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="Copy terminal command"
                >
                  {copiedId === 'runner-cmd' ? <Check className="w-3 h-3 text-emerald-600" /> : <Play className="w-3 h-3 text-slate-500" />}
                  <span>{selectedExample.command}</span>
                </button>
                <button
                  onClick={() => copyText('code-body', selectedExample.code)}
                  className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  {copiedId === 'code-body' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Code</span>
                </button>
              </div>
            </div>

            {/* Description note */}
            <div className="p-4 bg-slate-50/30 border-b border-slate-100 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">What it demonstrates: </span>
              {selectedExample.description}
            </div>

            {/* Code Block */}
            <div className="p-4 bg-slate-950 overflow-x-auto text-xs font-mono text-slate-200 max-h-[480px]">
              <pre className="leading-relaxed whitespace-pre">{selectedExample.code}</pre>
            </div>
          </div>

          {/* NPM Package Export Matrix & Publish Checklist */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>NPM Package Metadata & Build Outputs</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block mb-1 font-medium">ESM Bundle</span>
                <code className="text-emerald-700 font-bold block">dist/sdk/index.js</code>
                <span className="text-[11px] text-slate-400 mt-1 block">ES2022 neutral target</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block mb-1 font-medium">CommonJS Bundle</span>
                <code className="text-emerald-700 font-bold block">dist/sdk/index.cjs</code>
                <span className="text-[11px] text-slate-400 mt-1 block">Node.js require() support</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block mb-1 font-medium">TypeScript Types</span>
                <code className="text-emerald-700 font-bold block">dist/sdk/index.d.ts</code>
                <span className="text-[11px] text-slate-400 mt-1 block">Full type declarations</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ready for NPM Open Source Release: <code className="font-mono text-slate-800">npm publish --access public</code></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">questrade-ts-sdk@1.0.0</span>
                <span className="font-semibold text-slate-700">MIT</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
