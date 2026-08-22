# Questrade TypeScript SDK - Examples Directory

This folder contains clean, self-contained TypeScript examples illustrating how to use `questrade-ts-sdk` in real-world Node.js or edge environments.

## Quick Run

You can run any example directly with `tsx`:

```bash
# 1. Provide your Questrade Refresh Token as an environment variable
export QUESTRADE_REFRESH_TOKEN="your_manual_token_from_questrade"

# 2. Run any example
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

## Example Index

| File | Description | Core APIs Covered |
| :--- | :--- | :--- |
| [`01-basic-authentication.ts`](./01-basic-authentication.ts) | Token exchange, auto-renewal callback, server time | `exchangeRefreshToken`, `onTokenRefresh`, `getServerTime` |
| [`02-account-portfolio.ts`](./02-account-portfolio.ts) | Discovery of TFSA/Margin/RRSP accounts, CAD/USD balances & positions | `getAccounts`, `getBalances`, `getPositions` |
| [`03-market-quotes-candles.ts`](./03-market-quotes-candles.ts) | Symbol lookup, Level 1 snap quotes & OHLCV historical bars | `searchSymbols`, `getQuote`, `getQuotes`, `getCandles` |
| [`04-websocket-streaming.ts`](./04-websocket-streaming.ts) | Real-time push feed for Level 1 quotes & order notifications | `QuestradeStreamFeed`, `.on('quote')`, `.subscribe()` |
| [`05-batch-polling-feed.ts`](./05-batch-polling-feed.ts) | High-throughput batch polling with tick deduplication & latency metrics | `QuestradePollFeed`, `deduplicate: true`, `adaptive: true` |
| [`06-hybrid-market-feed.ts`](./06-hybrid-market-feed.ts) | Unified feed with automatic failover from WebSocket to polling | `QuestradeMarketFeed`, `mode: 'auto'` |
| [`07-options-chains.ts`](./07-options-chains.ts) | Discover options expirations, strike prices, roots and option quotes | `getOptionChain`, `getOptionQuotes` |
| [`08-order-lifecycle.ts`](./08-order-lifecycle.ts) | Pre-trade impact test, order placement, order replacement & cancellation | `testOrder`, `placeOrder`, `replaceOrder`, `cancelOrder` |

---

## Prerequisites & Getting a Questrade Token

1. Log into your [Questrade Account Portal](https://my.questrade.com).
2. Navigate to **Account Management** > **App Hub**.
3. Register a personal application or generate a **Manual Refresh Token**.
4. Set the environment variable:
   ```bash
   export QUESTRADE_REFRESH_TOKEN="<paste_token_here>"
   ```
5. Alternatively, you can pass existing access tokens:
   ```bash
   export QUESTRADE_ACCESS_TOKEN="<token>"
   export QUESTRADE_API_SERVER="https://api01.iq.questrade.com"
   ```
