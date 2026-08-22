/**
 * Example 08: Order Lifecycle - Pre-Trade Impact, Placing, Modifying & Canceling
 * 
 * Demonstrates:
 * 1. Performing pre-trade impact test (`testOrder`) to verify buying power and margin requirements without execution.
 * 2. Placing a limit order (`placeOrder`).
 * 3. Querying active orders for the account (`getOrders`).
 * 4. Modifying / replacing order price or quantity (`replaceOrder`).
 * 5. Canceling the order (`cancelOrder`).
 * 
 * Run with:
 *   npx tsx examples/08-order-lifecycle.ts
 */

import { QuestradeClient } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 08 - Order Lifecycle ---');

  const client = new QuestradeClient({
    refreshToken: process.env.QUESTRADE_REFRESH_TOKEN,
    accessToken: process.env.QUESTRADE_ACCESS_TOKEN,
    apiServer: process.env.QUESTRADE_API_SERVER,
  });

  try {
    // 1. Get primary account
    const accounts = await client.getAccounts();
    if (!accounts.length) {
      throw new Error('No accounts found for authenticated user.');
    }
    const account = accounts.find((a) => a.isPrimary) || accounts[0];
    console.log(`Using Account #${account.number} (${account.type})\n`);

    // Target stock: SHOP.TO (symbolId 8049)
    const targetSymbolId = 8049;

    // 2. Pre-Trade Impact Check (Test Order)
    console.log('🧪 1. Testing order impact (Pre-Trade Validation)...');
    const impact = await client.testOrder(account.number, {
      symbolId: targetSymbolId,
      quantity: 10,
      limitPrice: 130.00,
      orderType: 'Limit',
      timeInForce: 'Day',
      action: 'Buy',
    });

    console.log('   Impact Results:');
    console.log(`   - Estimated Commission: $${impact.commission ?? impact.estimatedCommission ?? 4.95}`);
    console.log(`   - Buying Power Effect:  $${impact.buyingPowerEffect}`);
    console.log(`   - Trade Value:          $${impact.tradeValue}\n`);

    // 3. Place Limit Order
    console.log('📝 2. Placing Limit Buy Order (10 shares @ $125.00)...');
    const orderResult = await client.placeOrder(account.number, {
      symbolId: targetSymbolId,
      quantity: 10,
      limitPrice: 125.00,
      orderType: 'Limit',
      timeInForce: 'Day',
      action: 'Buy',
    });

    const createdOrderId = orderResult.orderId;
    console.log(` Order successfully submitted! Order ID: ${createdOrderId}\n`);

    // 4. Inspect Open Orders
    console.log('📋 3. Fetching open orders...');
    const openOrders = await client.getOrders(account.number, { stateFilter: 'Open' });
    console.log(`Found ${openOrders.length} open order(s):`);
    openOrders.forEach((o) => {
      console.log(`   - Order #${o.id}: ${o.side} ${o.totalQuantity} ${o.symbol} @ $${o.limitPrice ?? 'MKT'} [${o.state}]`);
    });

    // 5. Replace / Modify Order Price
    console.log(`\n✏️ 4. Modifying Order #${createdOrderId} limit price to $126.50...`);
    const replaced = await client.replaceOrder(account.number, createdOrderId, {
      limitPrice: 126.50,
      quantity: 10,
    });
    console.log(` Order updated! New Order ID: ${replaced.orderId || createdOrderId}\n`);

    // 6. Cancel Order
    console.log(`❌ 5. Canceling Order #${createdOrderId}...`);
    await client.cancelOrder(account.number, createdOrderId);
    console.log(` Order #${createdOrderId} cancelled successfully.`);

  } catch (err: any) {
    console.error('❌ Order execution error:', err.message || err);
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
