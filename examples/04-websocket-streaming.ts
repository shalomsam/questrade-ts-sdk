/**
 * Example 04: Real-Time WebSocket Market Data & Order Streaming
 * 
 * Demonstrates:
 * 1. Negotiating Questrade WebSocket stream port.
 * 2. Connecting to the real-time Quote & Order stream.
 * 3. Subscribing and unsubscribing to multiple symbol IDs.
 * 4. Handling live price tick events, connection state changes, and heartbeat health checks.
 * 
 * Run with:
 *   npx tsx examples/04-websocket-streaming.ts
 */

import { QuestradeClient, QuestradeStreamFeed } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 04 - WebSocket Streaming ---');

  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    accessToken: process.env.QUESTRADE_ACCESS_TOKEN,
    apiServer: process.env.QUESTRADE_API_SERVER,
  });

  // Create WebSocket streaming feed instance
  const streamFeed = new QuestradeStreamFeed(client, {
    autoReconnect: true,
    maxReconnectAttempts: 5,
    heartbeatIntervalMs: 30000,
  });

  // 1. Listen for real-time Level 1 quote ticks
  streamFeed.on('quote', (quote) => {
    const time = new Date(quote.lastTradeTime || Date.now()).toLocaleTimeString();
    console.log(
      `⚡ [TICK ${time}] ${quote.symbol.padEnd(8)} | Last: $${(quote.lastTradePriceTraded ?? 0).toFixed(2).padStart(7)} | Bid: $${(quote.bidPrice ?? 0).toFixed(2)} | Ask: $${(quote.askPrice ?? 0).toFixed(2)} | Vol: ${quote.volume.toLocaleString()}`
    );
  });

  // 2. Listen for order updates
  streamFeed.on('order', (order) => {
    console.log(`📋 [ORDER EVENT] Order #${order.id} for ${order.symbol}: State = ${order.state} | Filled = ${order.filledQuantity}/${order.totalQuantity}`);
  });

  // 3. Monitor connection state & telemetry
  streamFeed.on('connected', () => {
    console.log(' WebSocket stream connected successfully!');
  });

  streamFeed.on('reconnecting', (attempt) => {
    console.warn(`⚠️ Reconnecting to Questrade stream (attempt #${attempt})...`);
  });

  streamFeed.on('error', (err) => {
    console.error('❌ Stream error:', err.message);
  });

  streamFeed.on('stats', (stats) => {
    console.log(`📊 [Telemetry] Latency: ${stats.latencyMs}ms | Ticks/sec: ${stats.ticksPerSecond.toFixed(1)} | Total: ${stats.totalTicksReceived}`);
  });

  try {
    console.log('Initiating WebSocket connection...');
    await streamFeed.connect();

    // Subscribe to symbol IDs (e.g. SHOP.TO = 8049, RY.TO = 9291, AAPL = 12049)
    console.log('Subscribing to symbols [8049, 9291, 12049]...\n');
    await streamFeed.subscribe([8049, 9291, 12049]);

    console.log('Streaming active! Press Ctrl+C to terminate or waiting 30 seconds...\n');

    // Keep process alive for 30 seconds in example mode
    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log('\nUnsubscribing and closing stream cleanly...');
    await streamFeed.unsubscribe([8049, 9291, 12049]);
    await streamFeed.disconnect();
    console.log('Done.');

  } catch (err: any) {
    console.error('❌ Stream execution error:', err.message || err);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
