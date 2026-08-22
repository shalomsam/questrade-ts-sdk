/**
 * Example 07: Options Chain Discovery & Option Quote Queries
 * 
 * Demonstrates:
 * 1. Fetching full option chains for an equity underlying (e.g. SHOP.TO / AAPL).
 * 2. Parsing expiration dates, strike prices, roots, and contract multipliers.
 * 3. Querying Level 1 real-time options quotes with filtered strike boundaries.
 * 
 * Run with:
 *   npx tsx examples/07-options-chains.ts
 */

import { QuestradeClient } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 07 - Options Chains & Quotes ---');

  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    accessToken: process.env.QUESTRADE_ACCESS_TOKEN,
    apiServer: process.env.QUESTRADE_API_SERVER,
  });

  const underlyingSymbolId = 8049; // SHOP.TO
  const underlyingTicker = 'SHOP.TO';

  try {
    // 1. Retrieve Option Chain Node structure
    console.log(` Fetching options chain for ${underlyingTicker} (ID: ${underlyingSymbolId})...`);
    const chainNodes = await client.getOptionChain(underlyingSymbolId);
    console.log(`Found ${chainNodes.length} expiration cycle(s):\n`);

    for (const node of chainNodes.slice(0, 3)) {
      const expDate = node.expiryDate.split('T')[0];
      const rootInfo = node.chainPerRoot[0];
      const strikeCount = rootInfo ? rootInfo.strikePrices.length : 0;
      const strikesSample = rootInfo ? rootInfo.strikePrices.slice(0, 5).join(', ') : '';

      console.log(`📅 Expiry: ${expDate} | Type: ${node.optionExerciseType} | Root: ${rootInfo?.root || 'N/A'}`);
      console.log(`   Strikes (${strikeCount} total): [${strikesSample}, ...]`);
    }

    // 2. Fetch specific option quotes for near-the-money strikes
    if (chainNodes.length > 0) {
      const firstExpiry = chainNodes[0].expiryDate;
      console.log(`\n Fetching option quotes for expiry: ${firstExpiry.split('T')[0]}...`);

      const optionQuotes = await client.getOptionQuotes([
        {
          underlyingId: underlyingSymbolId,
          expiryDate: firstExpiry,
          minstrikePrice: 120,
          maxstrikePrice: 150,
        },
      ]);

      console.log(`Retrieved ${optionQuotes.length} option quote contract(s):`);
      console.table(
        optionQuotes.slice(0, 8).map((q) => ({
          Symbol: q.symbol,
          Bid: `$${q.bidPrice ?? 0}`,
          Ask: `$${q.askPrice ?? 0}`,
          Last: `$${q.lastTradePriceTraded ?? 0}`,
          Vol: q.volume,
        }))
      );
    }

  } catch (err: any) {
    console.error('❌ Error fetching option chain:', err.message || err);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
