/**
 * Example 06: Unified Hybrid Market Feed with Automatic Fallback
 * 
 * Demonstrates:
 * 1. Using `QuestradeMarketFeed` in 'auto' mode.
 * 2. Automatic primary attempt on real-time WebSocket streaming.
 * 3. Seamless failover to adaptive HTTP batch polling if WebSocket is blocked (e.g. strict corporate firewalls, missing ports).
 * 4. Transparent unified API surface regardless of transport method.
 * 
 * Run with:
 *   npx tsx examples/06-hybrid-market-feed.ts
 */

import { QuestradeClient, QuestradeMarketFeed } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 06 - Hybrid Market Feed ---');

  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    accessToken: process.env.QUESTRADE_ACCESS_TOKEN,
    apiServer: process.env.QUESTRADE_API_SERVER,
  });

  // Create unified feed in AUTO mode (attempts stream first, falls back to polling)
  const feed = new QuestradeMarketFeed(client, {
    mode: 'auto',
    streamOptions: {
      autoReconnect: true,
      maxReconnectAttempts: 3,
    },
    pollOptions: {
      intervalMs: 1000,
      deduplicate: true,
    },
  });

  feed.on('quote', (quote) => {
    console.log(`✨ [FEED TCK] ${quote.symbol}: $${quote.lastTradePriceTraded} (Mode: ${feed.getStats().mode})`);
  });

  feed.on('modeChange', (newMode, reason) => {
    console.log(`🔀 [Mode Switched] Transport is now: ${newMode.toUpperCase()} (Reason: ${reason || 'Configured'})`);
  });

  feed.on('stats', (stats) => {
    console.log(`📊 [Metrics] Active Mode: ${stats.mode} | Subscribed: ${stats.subscribedCount} | State: ${stats.connectionState}`);
  });

  try {
    console.log('Starting Unified Market Feed...');
    await feed.start();

    // Subscribe to symbols
    feed.subscribe([8049, 9291, 12049]);

    console.log('Feed running for 15 seconds...\n');
    await new Promise((resolve) => setTimeout(resolve, 15000));

    console.log('\nStopping Feed...');
    await feed.stop();
    console.log('Clean shutdown complete.');

  } catch (err: any) {
    console.error('❌ Hybrid feed error:', err.message || err);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
