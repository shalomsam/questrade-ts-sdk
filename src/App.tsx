/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { MarketFeedWorkbench } from './components/MarketFeedWorkbench.tsx';
import { PortfolioExplorer } from './components/PortfolioExplorer.tsx';
import { SymbolSearchExplorer } from './components/SymbolSearchExplorer.tsx';
import { ApiRunner } from './components/ApiRunner.tsx';
import { ExamplesExplorer } from './components/ExamplesExplorer.tsx';
import { SdkSourceViewer } from './components/SdkSourceViewer.tsx';
import { DocsAndGuide } from './components/DocsAndGuide.tsx';
import { QuestradeClient } from './sdk/client.ts';
import { QuestradeCredentials } from './sdk/types.ts';

export default function App() {
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [activeTab, setActiveTab] = useState<'feeds' | 'accounts' | 'symbols' | 'api' | 'examples' | 'sdk' | 'docs'>('feeds');
  const [liveCredentials, setLiveCredentials] = useState<QuestradeCredentials | null>(null);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'questrade-oauth') return;
      const data = event.data.data;
      setLiveCredentials({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        apiServer: data.api_server,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + (data.expires_in || 1800) * 1000,
      });
      setMode('live');
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const handleStartOAuth = () => {
    window.open('/api/questrade/oauth/start', 'questrade-oauth', 'popup,width=520,height=720');
  };

  // Instantiate client dynamically based on mode and credentials
  const client = useMemo(() => {
    if (mode === 'sandbox') {
      return new QuestradeClient({
        apiServer: window.location.origin + '/api/sandbox',
        accessToken: 'SANDBOX_ACCESS_TOKEN',
      });
    }

    return new QuestradeClient({
      accessToken: liveCredentials?.accessToken,
      apiServer: liveCredentials?.apiServer,
      refreshToken: liveCredentials?.refreshToken,
      proxyUrl: window.location.origin + '/api/questrade/proxy',
      autoRefresh: true,
      onTokenRefresh: (creds) => {
        setLiveCredentials(creds);
      },
    });
  }, [mode, liveCredentials]);

  const handleSaveCredentials = async (token: string) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      // Exchange token via backend proxy
      const res = await fetch('/api/questrade/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error_description || `HTTP ${res.status}: Token exchange failed`);
      }

      const data = await res.json();
      const newCreds: QuestradeCredentials = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        apiServer: data.api_server,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + (data.expires_in || 1800) * 1000,
      };

      setLiveCredentials(newCreds);
      setMode('live');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to exchange Questrade refresh token.');
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleClearCredentials = () => {
    setLiveCredentials(null);
    setMode('sandbox');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Header
        mode={mode}
        onModeChange={setMode}
        credentials={liveCredentials}
        onSaveCredentials={handleSaveCredentials}
        onClearCredentials={handleClearCredentials}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAuthenticating={isAuthenticating}
        authError={authError}
        onStartOAuth={handleStartOAuth}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'feeds' && <MarketFeedWorkbench client={client} mode={mode} />}
        {activeTab === 'accounts' && <PortfolioExplorer client={client} mode={mode} />}
        {activeTab === 'symbols' && <SymbolSearchExplorer client={client} mode={mode} />}
        {activeTab === 'api' && <ApiRunner client={client} mode={mode} />}
        {activeTab === 'examples' && <ExamplesExplorer />}
        {activeTab === 'sdk' && <SdkSourceViewer />}
        {activeTab === 'docs' && <DocsAndGuide />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <span className="font-semibold text-slate-700">questrade-ts-sdk</span> — Lightweight, zero-dependency TypeScript SDK for Questrade API.
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>TSX & US Equities</span>
            <span>•</span>
            <span>WebSocket L1 Stream</span>
            <span>•</span>
            <span>Adaptive Polling</span>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
