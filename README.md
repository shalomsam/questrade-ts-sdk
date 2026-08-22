# questrade-ts-sdk

[![npm version](https://img.shields.io/npm/v/questrade-ts-sdk.svg?style=flat-square)](https://www.npmjs.com/package/questrade-ts-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](https://bundlephobia.com/package/questrade-ts-sdk)

A lightweight, zero-dependency, production-ready TypeScript SDK for the **Questrade API** ([official documentation](https://www.questrade.com/api/documentation/getting-started)). Designed for algorithmic traders, portfolio trackers, and financial app developers in Node.js, Bun, Deno, and modern browser environments.

---

## ✨ Features

- **⚡ Zero External Dependencies:** Powered exclusively by native web standards (`fetch`, `WebSocket`, `AbortController`).
- **🛡️ 100% Type Safe:** Complete, hand-crafted TypeScript types matching official Questrade REST and Streaming schemas.
- **🔄 Automated Token Lifecycle:** Automatic OAuth token refreshing before expiration with custom persistence callbacks (`onTokenRefresh`).
- **📈 Dual Market Data Feeds:**
  - **WebSocket Streaming (`QuestradeStreamFeed`):** High-speed push updates for Level 1 quotes and order executions with automatic heartbeat and reconnection.
  - **Adaptive Polling (`QuestradePollFeed`):** High-efficiency HTTP batch polling (up to 100 tickers per request) with tick deduplication and error backoff.
  - **Hybrid Manager (`QuestradeMarketFeed`):** Seamless automatic failover between WebSocket streaming and adaptive polling.
- **💼 Complete Trading Suite:** Accounts, CAD/USD multi-currency balances, open positions, order testing (`testOrder`), order placement, modification, and cancellation.
- **📊 Rich Market Data:** Symbol lookup, detailed security metadata, historical OHLCV candlestick time series, option chains, and option quotes.
- **🚦 Built-In Resilience:** Automatic exponential backoff for HTTP 429 rate limits, request timeouts, and transient network errors.

---

## 📦 Installation

```bash
npm install questrade-ts-sdk
# or
pnpm add questrade-ts-sdk
# or
yarn add questrade-ts-sdk
```

---

## 🚀 Quick Start

```typescript
import { QuestradeClient } from 'questrade-ts-sdk';

// 1. Initialize with your Questrade Refresh Token
const client = new QuestradeClient({
  refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
  autoRefresh: true,
  onTokenRefresh: (creds) => {
    console.log('New refresh token received. Save this to your database:', creds.refreshToken);
  },
});

async function main() {
  // 2. Discover accounts & balances
  const accounts = await client.getAccounts();
  console.log(`Found ${accounts.length} account(s)`);

  const balances = await client.getBalances(accounts[0].number);
  console.log('Account Total Equity:', balances.combinedBalances[0]?.totalEquity);

  // 3. Query real-time quote for Shopify (TSX: SHOP.TO = ID 8049)
  const quote = await client.getQuote(8049);
  console.log(`${quote.symbol}: Bid $${quote.bidPrice} / Ask $${quote.askPrice} | Last: $${quote.lastTradePriceTraded}`);
}

main().catch(console.error);
```

---

## 🔑 Authentication & Token Management

Questrade provides a manual or OAuth refresh token that expires after its first use. When exchanged, Questrade returns a short-lived **access token**, an **api_server** URL, and a **new refresh token**.

`questrade-ts-sdk` manages this entire lifecycle automatically:

```typescript
import { QuestradeClient } from 'questrade-ts-sdk';

const client = new QuestradeClient({
  refreshToken: 'YOUR_INITIAL_REFRESH_TOKEN',
  autoRefresh: true, // Auto-renews 2 minutes before access token expires
  onTokenRefresh: async (newCreds) => {
    // Persist new refresh token to disk / database
    await saveCredentialsToVault(newCreds);
  },
});

// Explicitly exchange or verify authentication:
await client.exchangeRefreshToken();
console.log('Authenticated! Connected to:', client.getCredentials()?.apiServer);
```

---

## 📡 Market Data Feeds

### 1. Real-Time WebSocket Streaming (`QuestradeStreamFeed`)

Subscribes to Questrade's WebSocket push feed for low-latency Level 1 ticks and order lifecycle events.

```typescript
import { QuestradeClient, QuestradeStreamFeed } from 'questrade-ts-sdk';

const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
const stream = new QuestradeStreamFeed(client, {
  autoReconnect: true,
  heartbeatIntervalMs: 30000,
});

// Listen for live quotes
stream.on('quote', (quote) => {
  console.log(`⚡ [TICK] ${quote.symbol}: $${quote.lastTradePriceTraded} (Vol: ${quote.volume})`);
});

// Listen for order fills
stream.on('order', (order) => {
  console.log(`📋 Order #${order.id} ${order.state}: filled ${order.filledQuantity}/${order.totalQuantity}`);
});

await stream.connect();
stream.subscribe([8049, 9291, 12049]); // SHOP.TO, RY.TO, AAPL
```

### 2. High-Throughput Batch Polling (`QuestradePollFeed`)

Ideal for web apps or environments where WebSockets are firewalled or restricted. Features built-in tick deduplication so listeners are only notified when price, spread, or volume changes.

```typescript
import { QuestradeClient, QuestradePollFeed } from 'questrade-ts-sdk';

const client = new QuestradeClient({ refreshToken: process.env.QUESTRADE_REFRESH_TOKEN });
const pollFeed = new QuestradePollFeed(client, {
  intervalMs: 1000,
  batchSize: 50,     // Batches up to 100 symbols per request
  deduplicate: true, // Filters out duplicate ticks
  adaptive: true,    // Adjusts interval based on response times
});

pollFeed.on('quote', (quote) => {
  console.log(`🔔 [TICK] ${quote.symbol}: $${quote.lastTradePriceTraded}`);
});

pollFeed.subscribe([8049, 9291, 12049]);
pollFeed.start();
```

### 3. Unified Hybrid Feed (`QuestradeMarketFeed`)

Automatically tries WebSocket streaming first, and seamlessly switches to adaptive polling if streaming connection fails.

```typescript
import { QuestradeClient, QuestradeMarketFeed } from 'questrade-ts-sdk';

const feed = new QuestradeMarketFeed(client, { mode: 'auto' });

feed.on('quote', (quote) => console.log(quote.symbol, quote.lastTradePriceTraded));
feed.on('modeChange', (newMode) => console.log(`Active transport: ${newMode}`));

await feed.start();
feed.subscribe([8049, 9291]);
```

---

## 📈 Historical Candlesticks (OHLCV)

Retrieve historical candlestick bars across multiple timeframes (`OneMinute`, `FiveMinutes`, `OneHour`, `OneDay`, `OneWeek`, etc.):

```typescript
const candles = await client.getCandles(8049, {
  startTime: new Date('2025-01-01T00:00:00Z'),
  endTime: new Date('2025-01-31T23:59:59Z'),
  interval: 'OneDay',
});

for (const candle of candles) {
  console.log(`${candle.start}: O=$${candle.open} H=$${candle.high} L=$${candle.low} C=$${candle.close} Vol=${candle.volume}`);
}
```

---

## 💼 Orders & Trading

### Pre-Trade Impact Test (No execution)
```typescript
const impact = await client.testOrder(accountNumber, {
  symbolId: 8049,
  quantity: 10,
  limitPrice: 130.00,
  orderType: 'Limit',
  timeInForce: 'Day',
  action: 'Buy',
});

console.log('Estimated Commission:', impact.commission);
console.log('Buying Power Effect:', impact.buyingPowerEffect);
```

### Submitting, Modifying, and Canceling Orders
```typescript
// 1. Submit Limit Order
const result = await client.placeOrder(accountNumber, {
  symbolId: 8049,
  quantity: 10,
  limitPrice: 125.00,
  orderType: 'Limit',
  timeInForce: 'Day',
  action: 'Buy',
});
const orderId = result.orderId;

// 2. Modify / Replace Order
await client.replaceOrder(accountNumber, orderId, {
  limitPrice: 126.00,
  quantity: 10,
});

// 3. Cancel Order
await client.cancelOrder(accountNumber, orderId);
```

---

## 🎯 Options Chains & Quotes

```typescript
// 1. Fetch Option Chains (Expirations, Roots, Strikes)
const chain = await client.getOptionChain(8049); // SHOP.TO
console.log('First Expiry Date:', chain[0].expiryDate);
console.log('Available Strikes:', chain[0].chainPerRoot[0].strikePrices);

// 2. Fetch Option Quotes
const optionQuotes = await client.getOptionQuotes([
  {
    underlyingId: 8049,
    expiryDate: chain[0].expiryDate,
    minstrikePrice: 120,
    maxstrikePrice: 140,
  },
]);
```

---

## 📁 Examples

Run any of the included scripts in the [`examples/`](./examples) directory:

```bash
# Set your token
export QUESTRADE_REFRESH_TOKEN="your_token"

npx tsx examples/01-basic-authentication.ts
npx tsx examples/02-account-portfolio.ts
npx tsx examples/03-market-quotes-candles.ts
npx tsx examples/04-websocket-streaming.ts
npx tsx examples/05-batch-polling-feed.ts
npx tsx examples/06-hybrid-market-feed.ts
npx tsx examples/07-options-chains.ts
npx tsx examples/08-order-lifecycle.ts
```

---

## 🛠️ API Reference

| Class / Method | Endpoint / Purpose |
| :--- | :--- |
| `client.getServerTime()` | `GET v1/time` |
| `client.getAccounts()` | `GET v1/accounts` |
| `client.getBalances(accountId)` | `GET v1/accounts/:id/balances` |
| `client.getPositions(accountId)` | `GET v1/accounts/:id/positions` |
| `client.getOrders(accountId, options?)` | `GET v1/accounts/:id/orders` |
| `client.getOrder(accountId, orderId)` | `GET v1/accounts/:id/orders/:orderId` |
| `client.getExecutions(accountId, options?)` | `GET v1/accounts/:id/executions` |
| `client.getActivities(accountId, options?)` | `GET v1/accounts/:id/activities` |
| `client.searchSymbols(prefix)` | `GET v1/symbols/search` |
| `client.getSymbol(id)` | `GET v1/symbols/:id` |
| `client.getSymbolsByIds(ids)` | `GET v1/symbols?ids=...` |
| `client.getSymbolsByNames(names)` | `GET v1/symbols?names=...` |
| `client.getQuote(id)` | `GET v1/markets/quotes/:id` |
| `client.getQuotes(ids)` | `GET v1/markets/quotes?ids=...` |
| `client.getCandles(id, options)` | `GET v1/markets/candles/:id` |
| `client.getOptionChain(symbolId)` | `GET v1/symbols/:id/options` |
| `client.getOptionQuotes(filters)` | `POST v1/markets/quotes/options` |
| `client.getMarkets()` | `GET v1/markets` |
| `client.testOrder(accountId, order)` | `POST v1/accounts/:id/orders/impact` |
| `client.placeOrder(accountId, order)` | `POST v1/accounts/:id/orders` |
| `client.replaceOrder(accountId, orderId, order)` | `POST v1/accounts/:id/orders/:orderId` |
| `client.cancelOrder(accountId, orderId)` | `DELETE v1/accounts/:id/orders/:orderId` |
| `QuestradeStreamFeed` | Real-time WebSocket market data & order push feed |
| `QuestradePollFeed` | Smart adaptive batch polling with deduplication |
| `QuestradeMarketFeed` | Unified feed with auto-failover |

---

## 🛡️ Error Handling

All SDK errors inherit from `QuestradeError`:

- `QuestradeAuthError`: Token exchange failures, invalid credentials (401).
- `QuestradeRateLimitError`: Rate limit exceeded (429) with `retryAfterSeconds`.
- `QuestradeNotFoundError`: Resource or symbol not found (404).
- `QuestradeValidationError`: Missing parameters or invalid arguments (400).
- `QuestradeStreamError`: WebSocket transport or handshake errors.

```typescript
import { QuestradeRateLimitError, QuestradeAuthError } from 'questrade-ts-sdk';

try {
  await client.getQuote(8049);
} catch (err) {
  if (err instanceof QuestradeRateLimitError) {
    console.warn(`Rate limited! Retry after ${err.retryAfterSeconds} seconds.`);
  } else if (err instanceof QuestradeAuthError) {
    console.error('Authentication invalid or expired.');
  }
}
```

---

## 📄 License

[MIT License](./LICENSE) © 2026 Questrade TypeScript SDK Contributors.
