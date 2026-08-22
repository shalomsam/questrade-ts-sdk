import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { MockQuestradeEngine } from './src/sdk/mock-engine.ts';

dotenv.config();

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/stream' });

const mockEngine = new MockQuestradeEngine();

app.use(express.json());

// ==========================================
// Questrade Live API Proxy Endpoints
// ==========================================

// 1. Refresh Token Exchange Proxy
app.post('/api/questrade/exchange-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ code: 1003, message: 'Missing refreshToken in request body.' });
    }

    const tokenUrl = `https://login.questrade.com/oauth2/token?grant_type=refresh_token&refresh_token=${encodeURIComponent(
      refreshToken
    )}`;

    const response = await fetch(tokenUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (err: any) {
    console.error('[Questrade Proxy] Token exchange error:', err);
    return res.status(500).json({ code: 1030, message: `Token exchange proxy error: ${err.message}` });
  }
});

// 2. Generic Questrade REST API Proxy (Handles CORS & Forwarding)
app.all('/api/questrade/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ message: 'Missing target URL in query (?url=...)' });
    }

    const authHeader = req.headers.authorization;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'] as string;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward response status and headers
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);

    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) res.setHeader('retry-after', retryAfter);

    const rateRemaining = response.headers.get('x-ratelimit-remaining');
    if (rateRemaining) res.setHeader('x-ratelimit-remaining', rateRemaining);

    const data = await response.text();
    return res.send(data);
  } catch (err: any) {
    console.error('[Questrade Proxy] Forward error:', err);
    return res.status(502).json({ code: 1030, message: `Proxy error: ${err.message}` });
  }
});

// ==========================================
// Sandbox Simulated REST Endpoints
// ==========================================

app.get('/api/sandbox/v1/time', (req, res) => {
  res.json({ time: new Date().toISOString() });
});

app.get('/api/sandbox/v1/accounts', (req, res) => {
  res.json({ accounts: mockEngine.getAccounts(), userId: 109284 });
});

app.get('/api/sandbox/v1/accounts/:id/positions', (req, res) => {
  res.json({ positions: mockEngine.getPositions(req.params.id) });
});

app.get('/api/sandbox/v1/accounts/:id/balances', (req, res) => {
  res.json(mockEngine.getBalances(req.params.id));
});

app.get('/api/sandbox/v1/accounts/:id/orders', (req, res) => {
  res.json({ orders: mockEngine.getOrders(req.params.id) });
});

app.get('/api/sandbox/v1/accounts/:id/executions', (req, res) => {
  res.json({ executions: mockEngine.getExecutions(req.params.id) });
});

app.get('/api/sandbox/v1/accounts/:id/activities', (req, res) => {
  res.json({ activities: mockEngine.getActivities(req.params.id) });
});

app.get('/api/sandbox/v1/symbols/search', (req, res) => {
  const prefix = (req.query.prefix as string) || '';
  res.json({ symbols: mockEngine.searchSymbols(prefix) });
});

app.get('/api/sandbox/v1/symbols', (req, res) => {
  const idsStr = req.query.ids as string;
  const namesStr = req.query.names as string;

  if (idsStr) {
    const ids = idsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    return res.json({ symbols: mockEngine.getSymbolsByIds(ids) });
  }

  if (namesStr) {
    const names = namesStr.split(',').map((s) => s.trim().toUpperCase());
    const all = mockEngine.getAllStocks();
    const matches = all.filter((s) => names.includes(s.symbol.toUpperCase()));
    return res.json({ symbols: mockEngine.getSymbolsByIds(matches.map((m) => m.id)) });
  }

  res.json({ symbols: [] });
});

app.get('/api/sandbox/v1/symbols/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const symbols = mockEngine.getSymbolsByIds([id]);
  if (symbols.length === 0) {
    return res.status(404).json({ code: 1011, message: `Symbol ${id} not found.` });
  }
  res.json({ symbols });
});

app.get('/api/sandbox/v1/symbols/:id/options', (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json({ optionChain: mockEngine.getOptionChain(id) });
});

app.get('/api/sandbox/v1/markets/quotes', (req, res) => {
  const isStream = req.query.stream === 'true';
  if (isStream) {
    return res.json({ streamPort: 3000 });
  }

  const idsStr = req.query.ids as string;
  if (!idsStr) return res.json({ quotes: [] });
  const ids = idsStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  res.json({ quotes: mockEngine.getQuotes(ids) });
});

app.get('/api/sandbox/v1/markets/quotes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const quotes = mockEngine.getQuotes([id]);
  res.json({ quotes });
});

app.get('/api/sandbox/v1/markets/candles/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const interval = (req.query.interval as any) || 'OneDay';
  res.json({ candles: mockEngine.getCandles(id, interval, 30) });
});

// ==========================================
// WebSocket Streaming Engine
// ==========================================

interface ClientSubscription {
  ws: WebSocket;
  symbols: Set<number>;
  authenticated: boolean;
}

const clientSubscriptions = new Set<ClientSubscription>();

wss.on('connection', (ws) => {
  const sub: ClientSubscription = {
    ws,
    symbols: new Set([8049, 9291, 12049, 16840]),
    authenticated: true,
  };
  clientSubscriptions.add(sub);

  ws.on('message', (message) => {
    try {
      const text = message.toString();
      // Questrade auth handshake
      if (!text.startsWith('{')) {
        sub.authenticated = true;
        ws.send(JSON.stringify({ type: 'handshake', status: 'authenticated' }));
        return;
      }

      const data = JSON.parse(text);
      if (data.action === 'subscribe' && Array.isArray(data.symbolIds)) {
        for (const id of data.symbolIds) {
          sub.symbols.add(id);
        }
      } else if (data.action === 'unsubscribe' && Array.isArray(data.symbolIds)) {
        for (const id of data.symbolIds) {
          sub.symbols.delete(id);
        }
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    clientSubscriptions.delete(sub);
  });
});

// Broadcast live simulated market data ticks every 800ms
setInterval(() => {
  if (clientSubscriptions.size === 0) return;

  const allUpdatedQuotes = mockEngine.generateNextTick();

  for (const client of clientSubscriptions) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const clientQuotes = allUpdatedQuotes.filter((q) => client.symbols.has(q.symbolId));
      if (clientQuotes.length > 0) {
        client.ws.send(JSON.stringify({ quotes: clientQuotes }));
      }
    }
  }
}, 800);

// Heartbeat ping every 20s
setInterval(() => {
  for (const client of clientSubscriptions) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
    }
  }
}, 20000);

// ==========================================
// Vite Middleware & Static Serving
// ==========================================

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Questrade SDK & Workbench Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
