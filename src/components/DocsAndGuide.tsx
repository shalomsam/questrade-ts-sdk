import React, { useState } from 'react';
import { BookOpen, Key, Radio, RefreshCw, AlertTriangle, ShieldCheck, Check, Copy } from 'lucide-react';

export const DocsAndGuide: React.FC = () => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const snippets = {
    install: `npm install questrade-ts-sdk`,
    auth: `import { QuestradeClient } from 'questrade-ts-sdk';

// Initialize with a manual refresh token from Questrade API Centre
const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
  autoRefresh: true, // Automatically exchanges & refreshes before 30-min expiry
  onTokenRefresh: (creds) => {
    // Persist new refresh token to your secure database / secret manager
    console.log('Token refreshed. Save new refresh token:', creds.refreshToken);
  },
});`,
    streaming: `import { QuestradeClient, QuestradeStreamFeed } from 'questrade-ts-sdk';

const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
const stream = new QuestradeStreamFeed(client, {
  autoReconnect: true,
  heartbeatIntervalMs: 25000,
});

// Listen to push Level 1 ticks
stream.on('quote', (quote) => {
  console.log(\`[\${quote.symbol}] $\${quote.lastTradePriceTraded} (Bid: $\${quote.bidPrice} x \${quote.bidSize})\`);
});

// Subscribe to tickers by Symbol ID (SHOP.TO = 8049, AAPL = 12049)
stream.subscribeQuotes([8049, 12049]);
await stream.connect();`,
    polling: `import { QuestradeClient, QuestradePollFeed } from 'questrade-ts-sdk';

const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });

const pollFeed = new QuestradePollFeed(client, {
  intervalMs: 1000,   // Poll every 1s
  batchSize: 50,      // Max 100 per Questrade REST limit
  deduplicate: true,  // Only fires event if price/bid/ask/volume changed
  adaptive: true,     // Slows down during off-market hours or rate limits
});

pollFeed.on('quote', (quote) => {
  console.log('Deduplicated tick:', quote.symbol, quote.lastTradePriceTraded);
});

pollFeed.subscribeQuotes([8049, 9291, 12049]);
pollFeed.start();`,
    errors: `import {
  QuestradeClient,
  QuestradeAuthError,
  QuestradeRateLimitError,
  QuestradeNotFoundError,
} from 'questrade-ts-sdk';

try {
  const positions = await client.getPositions('28491028');
} catch (err) {
  if (err instanceof QuestradeAuthError) {
    console.error('Authentication expired. Need new refresh token.');
  } else if (err instanceof QuestradeRateLimitError) {
    console.warn(\`Rate limited. Retry after \${err.retryAfterSeconds}s\`);
  } else if (err instanceof QuestradeNotFoundError) {
    console.error('Account or symbol not found:', err.endpoint);
  }
}`,
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Documentation
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            Questrade TypeScript SDK Developer Guide
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Complete guide for integrating, authenticating, and streaming real-time market data feeds from Questrade.
        </p>
      </div>

      {/* 1. Installation */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>1. Installation</span>
        </h3>
        <p className="text-xs text-slate-600">
          Install the zero-dependency SDK package using npm, pnpm, or yarn:
        </p>
        <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs flex items-center justify-between">
          <code>{snippets.install}</code>
          <button
            type="button"
            onClick={() => copyCode('install', snippets.install)}
            className="text-slate-400 hover:text-slate-100"
          >
            {copiedSnippet === 'install' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </section>

      {/* 2. Authentication Flow */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-600" />
          <span>2. Authentication & Token Management</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Questrade uses OAuth 2.0. Access tokens expire in <strong>30 minutes</strong>, and Refresh Tokens can be used only once to obtain the next token pair and your assigned API server URL.
          The SDK manages auto-refreshing transparently before the 30-minute window expires.
        </p>

        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto relative">
          <button
            type="button"
            onClick={() => copyCode('auth', snippets.auth)}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-100"
          >
            {copiedSnippet === 'auth' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <pre className="text-emerald-300">{snippets.auth}</pre>
        </div>
      </section>

      {/* 3. Feeds Comparison */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-600" />
          <span>3. Real-Time Streaming vs. Batch Polling</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-700 text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Feature</th>
                <th className="p-3">WebSocket Stream Feed</th>
                <th className="p-3">Batch Polling Feed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="p-3 font-semibold text-slate-900">Transport</td>
                <td className="p-3 font-mono text-emerald-700">WebSocket (Persistent TCP)</td>
                <td className="p-3 font-mono text-slate-700">HTTP REST (v1/markets/quotes)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-900">Latency</td>
                <td className="p-3 text-emerald-700 font-semibold">&lt; 15 ms (Sub-millisecond push)</td>
                <td className="p-3">Configurable (250ms - 5000ms)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-900">Batching</td>
                <td className="p-3">Push per symbol tick</td>
                <td className="p-3">Up to 100 symbols per request</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-900">Platform Impact</td>
                <td className="p-3 text-amber-700">May lock streaming in active IQ Desktop</td>
                <td className="p-3 text-emerald-700">Safe concurrent usage alongside IQ Edge</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Stream Snippet */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>Streaming Engine Usage</span>
              <button
                type="button"
                onClick={() => copyCode('streaming', snippets.streaming)}
                className="text-slate-400 hover:text-slate-700"
              >
                {copiedSnippet === 'streaming' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="bg-slate-900 text-emerald-300 p-3 rounded-lg font-mono text-[11px] overflow-x-auto max-h-56">
              {snippets.streaming}
            </pre>
          </div>

          {/* Polling Snippet */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>Polling Engine Usage</span>
              <button
                type="button"
                onClick={() => copyCode('polling', snippets.polling)}
                className="text-slate-400 hover:text-slate-700"
              >
                {copiedSnippet === 'polling' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="bg-slate-900 text-emerald-300 p-3 rounded-lg font-mono text-[11px] overflow-x-auto max-h-56">
              {snippets.polling}
            </pre>
          </div>
        </div>
      </section>

      {/* 4. Error Handling */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>4. Robust Error Handling & Diagnostics</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          The SDK provides structured error classes extending <code>QuestradeError</code> with specific error codes, HTTP status codes, rate limit reset intervals, and diagnostics.
        </p>
        <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl font-mono text-xs overflow-x-auto">
          {snippets.errors}
        </pre>
      </section>
    </div>
  );
};
