/**
 * Example 03: Symbol Search, Level 1 Quotes & Historical Candles (OHLCV)
 * 
 * Demonstrates:
 * 1. Searching for symbols by ticker prefix (e.g., "SHOP", "AAPL").
 * 2. Fetching real-time Level 1 snapshot quotes (Bid, Ask, Spread, Volume, VWAP).
 * 3. Batch querying multiple quotes in a single network round-trip.
 * 4. Fetching historical OHLCV candlestick time series across customizable intervals.
 * 
 * Run with:
 *   npx tsx examples/03-market-quotes-candles.ts
 */

import { QuestradeClient } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 03 - Quotes & Historical Candles ---');

  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    accessToken: process.env.QUESTRADE_ACCESS_TOKEN,
    apiServer: process.env.QUESTRADE_API_SERVER,
  });

  try {
    // 1. Search for symbols
    console.log('🔍 Searching symbols for prefix "SHOP"...');
    const searchResults = await client.searchSymbols('SHOP');
    console.log(`Found ${searchResults.length} matching symbol(s):`);
    searchResults.slice(0, 3).forEach((s) => {
      console.log(`   - [${s.symbol}] ID: ${s.symbolId} | ${s.description} (${s.listingExchange})`);
    });

    const targetSymbol = searchResults[0] || { symbol: 'SHOP.TO', symbolId: 8049 };
    console.log(`\n Target Symbol: ${targetSymbol.symbol} (ID: ${targetSymbol.symbolId})\n`);

    // 2. Fetch Detailed Level 1 Snap Quote
    console.log(` Fetching Level 1 Quote for ${targetSymbol.symbol}...`);
    const quote = await client.getQuote(targetSymbol.symbolId);
    console.log(`   - Bid: $${quote.bidPrice ?? 'N/A'} (x${quote.bidSize ?? 0})`);
    console.log(`   - Ask: $${quote.askPrice ?? 'N/A'} (x${quote.askSize ?? 0})`);
    console.log(`   - Last Trade: $${quote.lastTradePriceTraded ?? 'N/A'} (Tick: ${quote.lastTradeTick ?? 'Equal'})`);
    console.log(`   - Day Range:  $${quote.lowPrice ?? 'N/A'} - $${quote.highPrice ?? 'N/A'}`);
    console.log(`   - Day Volume: ${quote.volume.toLocaleString()}`);
    console.log(`   - VWAP:       $${quote.vwap ?? 'N/A'}`);
    console.log(`   - Delay:      ${quote.delay}s (${quote.delay === 0 ? 'Real-Time' : 'Delayed'})\n`);

    // 3. Batch Quote Fetching
    console.log(' Fetching Batch Level 1 Quotes for multiple symbols [8049, 9291, 12049]...');
    const batchQuotes = await client.getQuotes([8049, 9291, 12049]);
    console.table(
      batchQuotes.map((q) => ({
        Symbol: q.symbol,
        Bid: `$${q.bidPrice ?? 'N/A'}`,
        Ask: `$${q.askPrice ?? 'N/A'}`,
        Last: `$${q.lastTradePriceTraded ?? 'N/A'}`,
        Volume: q.volume.toLocaleString(),
        Halted: q.isHalted ? 'YES' : 'NO',
      }))
    );

    // 4. Historical Candlesticks (OHLCV)
    console.log(`\n Fetching 1-Day historical candles for the last 14 days...`);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const candles = await client.getCandles(targetSymbol.symbolId, {
      startTime: fourteenDaysAgo,
      interval: 'OneDay',
    });

    console.log(`Retrieved ${candles.length} daily candle(s):`);
    console.table(
      candles.slice(-5).map((c) => ({
        Date: c.start.split('T')[0],
        Open: `$${c.open.toFixed(2)}`,
        High: `$${c.high.toFixed(2)}`,
        Low: `$${c.low.toFixed(2)}`,
        Close: `$${c.close.toFixed(2)}`,
        Volume: c.volume.toLocaleString(),
        VWAP: `$${c.VWAP.toFixed(2)}`,
      }))
    );

  } catch (err: any) {
    console.error('❌ Error querying market data:', err.message || err);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
