/**
 * Example 01: Basic Authentication and Automatic Token Refresh
 * 
 * Demonstrates:
 * 1. Initializing QuestradeClient with a manual Refresh Token.
 * 2. Authenticating & exchanging the refresh token for a live Access Token and API Server URL.
 * 3. Handling the `onTokenRefresh` callback to persist newly issued tokens.
 * 4. Checking server time to verify authentication status.
 * 
 * Run with:
 *   npx tsx examples/01-basic-authentication.ts
 */

import { QuestradeClient, QuestradeAuthError } from '../src/sdk/index.ts';

async function main() {
  console.log('--- Questrade SDK: Example 01 - Authentication ---');

  // Load refresh token from environment variable or provide directly
  const refreshToken = process.env.QUESTRADE_REFRESH_TOKEN || 'YOUR_MANUAL_REFRESH_TOKEN';

  // Instantiate client with automatic token refresh enabled
  const client = new QuestradeClient({
    refreshToken,
    autoRefresh: true,
    onTokenRefresh: async (credentials) => {
      console.log('🔄 [Token Refreshed] New credentials received:');
      console.log(`   - Access Token: ${credentials.accessToken.slice(0, 10)}...`);
      console.log(`   - API Server:   ${credentials.apiServer}`);
      console.log(`   - Refresh Token: ${credentials.refreshToken?.slice(0, 10)}...`);
      console.log(`   - Expires At:   ${new Date(credentials.expiresAt || 0).toISOString()}`);
      
      // In production, save `credentials.refreshToken` to a secure database or key vault:
      // await db.saveUserTokens(userId, credentials);
    },
  });

  try {
    // If you don't have active live tokens yet, exchange the initial refresh token:
    if (!client.isAuthenticated()) {
      console.log('Exchanging refresh token with login.questrade.com...');
      const creds = await client.exchangeRefreshToken();
      console.log(' Authentication successful!');
      console.log(`Connected to Questrade API server: ${creds.apiServer}\n`);
    }

    // Ping the server time endpoint to verify connectivity
    const serverTime = await client.getServerTime();
    console.log(` Questrade Server Time (ISO): ${serverTime}`);
    console.log(` Local System Time (ISO):   ${new Date().toISOString()}`);

  } catch (err) {
    if (err instanceof QuestradeAuthError) {
      console.error('❌ Authentication failed:', err.message);
      console.error('Tip: Make sure your Questrade Refresh Token is freshly generated from Questrade App Hub.');
    } else {
      console.error('❌ Unexpected error:', err);
    }
  }
}

if (import.meta.url.endsWith(process.argv[1]) || !process.argv[1]) {
  main().catch(console.error);
}
