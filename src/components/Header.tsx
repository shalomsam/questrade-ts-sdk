import React, { useState } from 'react';
import { Shield, Radio, Key, BookOpen, Code2, RefreshCw, CheckCircle2, AlertCircle, Copy, Check, Terminal } from 'lucide-react';
import { QuestradeCredentials } from '../sdk/types.ts';

interface HeaderProps {
  mode: 'sandbox' | 'live';
  onModeChange: (mode: 'sandbox' | 'live') => void;
  credentials: QuestradeCredentials | null;
  onSaveCredentials: (token: string) => Promise<void>;
  onClearCredentials: () => void;
  activeTab: 'feeds' | 'accounts' | 'symbols' | 'api' | 'examples' | 'sdk' | 'docs';
  onTabChange: (tab: 'feeds' | 'accounts' | 'symbols' | 'api' | 'examples' | 'sdk' | 'docs') => void;
  isAuthenticating: boolean;
  authError: string | null;
  onStartOAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  credentials,
  onSaveCredentials,
  onClearCredentials,
  activeTab,
  onTabChange,
  isAuthenticating,
  authError,
  onStartOAuth,
}) => {
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [inputToken, setInputToken] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    try {
      await onSaveCredentials(inputToken.trim());
      setShowTokenModal(false);
      setInputToken('');
    } catch {
      // handled in parent
    }
  };

  const copyNpmInstall = () => {
    navigator.clipboard.writeText('npm install questrade-ts-sdk');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold text-lg tracking-wider">
              QT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-slate-900 text-base leading-none">
                  questrade-ts-sdk
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  v1.0.0
                </span>
                <span className="hidden sm:inline-block text-xs text-slate-400">TypeScript SDK</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                Streaming & Polling Market Feeds • Complete Types • Error Handling
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            {[
              { id: 'feeds', label: 'Live Feeds', icon: Radio },
              { id: 'accounts', label: 'Portfolio', icon: Shield },
              { id: 'symbols', label: 'Quotes', icon: RefreshCw },
              { id: 'api', label: 'Playground', icon: Code2 },
              { id: 'examples', label: 'Examples & NPM', icon: Terminal },
              { id: 'sdk', label: 'SDK Source', icon: Code2 },
              { id: 'docs', label: 'Docs', icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Mode Switch & Auth State */}
          <div className="flex items-center gap-2.5">
            {/* Mode Switch Toggle */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
              <button
                id="mode-toggle-sandbox"
                type="button"
                onClick={() => onModeChange('sandbox')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  mode === 'sandbox'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sandbox Demo
              </button>
              <button
                id="mode-toggle-live"
                type="button"
                onClick={() => onModeChange('live')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                  mode === 'live'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                Live API
              </button>
            </div>

            {/* Auth / Token Trigger */}
            {mode === 'live' && (
              <button
                id="header-token-btn"
                type="button"
                onClick={() => setShowTokenModal(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                  credentials?.accessToken
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>{credentials?.accessToken ? 'Token Active' : 'Enter Token'}</span>
              </button>
            )}

            {/* Quick NPM Install Pill */}
            <button
              id="copy-npm-btn"
              type="button"
              onClick={copyNpmInstall}
              title="Copy npm install command"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 text-slate-100 text-xs font-mono rounded-lg hover:bg-slate-800 transition-colors"
            >
              <span>npm i questrade-ts-sdk</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-100">
          {[
            { id: 'feeds', label: 'Feeds' },
            { id: 'accounts', label: 'Accounts' },
            { id: 'symbols', label: 'Quotes' },
            { id: 'api', label: 'API Runner' },
            { id: 'sdk', label: 'SDK Source' },
            { id: 'docs', label: 'Docs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as any)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                activeTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Questrade API Token</h3>
                  <p className="text-xs text-slate-500">Connect to your Questrade personal app</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <button
                type="button"
                onClick={onStartOAuth}
                className="w-full px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium"
              >
                Sign in with Questrade OAuth
              </button>
              <div className="flex items-center gap-2 text-[11px] text-slate-400"><span className="h-px bg-slate-200 flex-1" /><span>or use a token</span><span className="h-px bg-slate-200 flex-1" /></div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Manual Refresh Token or Access Token
                </label>
                <input
                  id="questrade-token-input"
                  type="password"
                  placeholder="Paste your Questrade token here..."
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Generated in Questrade API Centre (Manage Account &gt; API Centre &gt; Generate Token).
                </p>
              </div>

              {authError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {credentials?.accessToken && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Session Connected</span>
                  </div>
                  <div className="text-emerald-700 font-mono text-[11px] truncate">
                    API Server: {credentials.apiServer}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {credentials?.accessToken && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearCredentials();
                      setShowTokenModal(false);
                    }}
                    className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating || !inputToken.trim()}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-1.5"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Save & Connect</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
