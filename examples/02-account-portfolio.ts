/**
 * Example 02: Account Discovery, Balances & Portfolio Positions
 * 
 * Demonstrates:
 * 1. Fetching user trading accounts (TFSA, Margin, RRSP, FHSA).
 * 2. Querying per-currency balances (CAD vs USD cash, equity, buying power).
 * 3. Inspecting open stock/ETF/option positions with P&L and market values.
 * 
 * Run with:
 *   npx tsx examples/02-account-portfolio.ts
 */

import { QuestradeClient } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 02 - Account & Portfolio ---');

  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    accessToken: process.env.QUESTRADE_ACCESS_TOKEN,
    apiServer: process.env.QUESTRADE_API_SERVER,
  });

  try {
    // 1. Retrieve all accounts
    console.log('Fetching accounts...');
    const accounts = await client.getAccounts();
    console.log(`Found ${accounts.length} trading account(s):\n`);

    for (const acc of accounts) {
      console.log(`=======================================================`);
      console.log(`Account: ${acc.type} (#${acc.number}) | Status: ${acc.status} | Primary: ${acc.isPrimary}`);
      console.log(`=======================================================`);

      // 2. Fetch balances for this account
      const balances = await client.getBalances(acc.number);
      console.log(' Balances:');
      for (const curr of balances.perCurrencyBalances) {
        console.log(`   [${curr.currency}] Cash: $${curr.cash.toFixed(2)} | Market Value: $${curr.marketValue.toFixed(2)} | Total Equity: $${curr.totalEquity.toFixed(2)} | Buying Power: $${curr.buyingPower.toFixed(2)}`);
      }

      if (balances.combinedBalances.length) {
        const combined = balances.combinedBalances[0];
        console.log(`   [Combined CAD] Total Equity: $${combined.totalEquity.toFixed(2)} | Cash: $${combined.cash.toFixed(2)}`);
      }

      // 3. Fetch open positions
      const positions = await client.getPositions(acc.number);
      console.log(`\n Open Positions (${positions.length}):`);
      if (positions.length === 0) {
        console.log('   (No open positions in this account)');
      } else {
        console.table(
          positions.map((p) => ({
            Symbol: p.symbol,
            Qty: p.openQuantity,
            'Avg Entry': `$${p.averageEntryPrice.toFixed(2)}`,
            'Current Price': `$${p.currentPrice.toFixed(2)}`,
            'Market Value': `$${p.currentMarketValue.toFixed(2)}`,
            'Open P&L': `$${p.openPnl >= 0 ? '+' : ''}${p.openPnl.toFixed(2)}`,
            'Total Cost': `$${p.totalCost.toFixed(2)}`,
          }))
        );
      }
      console.log('\n');
    }
  } catch (err: any) {
    console.error('❌ Error retrieving portfolio:', err.message || err);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
