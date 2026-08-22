/**
 * Example 05: High-Throughput Batch Polling Feed with Deduplication
 * 
 * Demonstrates:
 * 1. Initializing QuestradePollFeed with smart batching up to 100 symbols per request.
 * 2. Automatic tick deduplication (only fires events when price, spread, or volume changes).
 * 3. Dynamic polling interval adjustment (e.g. 500ms active vs 2000ms idle).
 * 4. Monitoring throughput metrics and network efficiency.
 * 
 * Run with:
 *   npx tsx examples/05-batch-polling-feed.ts
 */

import { QuestradeClient, QuestradePollFeed } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 05 - Smart Batch Polling Feed ---');

  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    accessToken: process.env.QUESTRADE_ACCESS_TOKEN,
    apiServer: process.env.QUESTRADE_API_SERVER,
  });

  // Create Polling Feed with deduplication and adaptive timing
  const pollFeed = new QuestradePollFeed(client, {
    intervalMs: 1000,
    batchSize: 50,
    deduplicate: true, // Filters out unchanged ticks, saving CPU and renders
    adaptive: true,    // Automatically backs off on network errors or slow responses
  });

  let ticksSeen = 0;

  // Listen for deduplicated price ticks
  pollFeed.on('quote', (quote) => {
    ticksSeen++;
    console.log(
      `🔔 [TICK #${ticksSeen}] ${quote.symbol.padEnd(8)} | Price: $${(quote.lastTradePriceTraded ?? 0).toFixed(2)} | Bid: $${quote.bidPrice} x ${quote.bidSize} | Ask: $${quote.askPrice} x ${quote.askSize} | Vol: ${quote.volume}`
    );
  });

  pollFeed.on('stats', (stats) => {
    console.log(
      `📈 [Poll Stats] Ticks/Sec: ${stats.ticksPerSecond.toFixed(1)} | Latency: ${stats.latencyMs}ms | Errors: ${stats.errorCount}`
    );
  });

  pollFeed.on('error', (err) => {
    console.error('⚠️ Polling error:', err.message);
  });

  try {
    console.log('Starting polling feed for symbols [8049, 9291, 4129, 12049, 14092, 16840]...');
    pollFeed.subscribe([8049, 9291, 4129, 12049, 14092, 16840]);
    pollFeed.start();

    console.log('Polling active for 20 seconds...\n');
    await new Promise((resolve) => setTimeout(resolve, 20000));

    console.log('\nStopping polling feed...');
    pollFeed.stop();
    console.log(`Finished. Total distinct ticks processed: ${ticksSeen}`);

  } catch (err: any) {
    console.error('❌ Polling feed error:', err.message || err);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
