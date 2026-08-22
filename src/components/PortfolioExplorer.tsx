import React, { useState, useEffect } from 'react';
import {
  Shield,
  DollarSign,
  TrendingUp,
  Briefcase,
  Layers,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Account, AccountBalance, Position, Order, Execution, Activity } from '../sdk/types.ts';
import { QuestradeClient } from '../sdk/client.ts';

interface PortfolioExplorerProps {
  client: QuestradeClient;
  mode: 'sandbox' | 'live';
}

export const PortfolioExplorer: React.FC<PortfolioExplorerProps> = ({ client, mode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [balances, setBalances] = useState<AccountBalance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [subTab, setSubTab] = useState<'positions' | 'balances' | 'orders' | 'executions' | 'activities'>('positions');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts on mount or client change
  useEffect(() => {
    let mounted = true;
    const fetchAccounts = async () => {
      setLoading(true);
      setError(null);
      try {
        const accs = await client.getAccounts();
        if (mounted) {
          setAccounts(accs);
          if (accs.length > 0) {
            setSelectedAccount(accs[0].number);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load accounts');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAccounts();
    return () => {
      mounted = false;
    };
  }, [client, mode]);

  // Fetch account specific data when selectedAccount changes
  useEffect(() => {
    if (!selectedAccount) return;
    let mounted = true;

    const fetchAccountData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [balData, posData, ordData, execData, actData] = await Promise.all([
          client.getBalances(selectedAccount).catch(() => null),
          client.getPositions(selectedAccount).catch(() => []),
          client.getOrders(selectedAccount).catch(() => []),
          client.getExecutions(selectedAccount).catch(() => []),
          client.getActivities(selectedAccount).catch(() => []),
        ]);

        if (mounted) {
          setBalances(balData);
          setPositions(posData || []);
          setOrders(ordData || []);
          setExecutions(execData || []);
          setActivities(actData || []);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load account details');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAccountData();
    return () => {
      mounted = false;
    };
  }, [selectedAccount, client]);

  // Calculations
  const totalCADCash = balances?.perCurrencyBalances.find((b) => b.currency === 'CAD')?.cash ?? 0;
  const totalUSDCash = balances?.perCurrencyBalances.find((b) => b.currency === 'USD')?.cash ?? 0;
  const combinedEquity = balances?.combinedBalances[0]?.totalEquity ?? 0;
  const combinedBuyingPower = balances?.combinedBalances[0]?.buyingPower ?? 0;

  const totalOpenPnl = positions.reduce((acc, p) => acc + p.openPnl, 0);

  return (
    <div className="space-y-6">
      {/* Account Selector Strip */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Portfolio
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              Questrade Accounts & Assets
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time balance calculations, active positions, open orders, and trade executions.
          </p>
        </div>

        {/* Account Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {accounts.map((acc) => (
            <button
              key={acc.number}
              id={`account-btn-${acc.number}`}
              onClick={() => setSelectedAccount(acc.number)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border ${
                selectedAccount === acc.number
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>{acc.type}</span>
              <span className="font-mono text-[11px] opacity-75">({acc.number})</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Total Combined Equity</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            ${combinedEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">CAD Combined Equivalent</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Buying Power</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            ${combinedBuyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">Margin & Cash Multiplier</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Open P&L</span>
            {totalOpenPnl >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono ${
              totalOpenPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {totalOpenPnl >= 0 ? '+' : ''}
            ${totalOpenPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">Unrealized Position Gains</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Cash Balances</span>
            <Briefcase className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="text-xs font-mono font-semibold text-slate-900">
              CAD: ${totalCADCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-mono font-semibold text-slate-900">
              USD: ${totalUSDCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">Dual Currency Cash</div>
        </div>
      </div>

      {/* Detail Section with Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-2 flex items-center justify-between">
          <div className="flex space-x-1">
            {[
              { id: 'positions', label: `Positions (${positions.length})` },
              { id: 'balances', label: 'Balances Breakdown' },
              { id: 'orders', label: `Orders (${orders.length})` },
              { id: 'executions', label: `Executions (${executions.length})` },
              { id: 'activities', label: `Activities (${activities.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                id={`subtab-${tab.id}`}
                onClick={() => setSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  subTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              <span>Loading account records...</span>
            </div>
          ) : subTab === 'positions' ? (
            positions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No open positions found in this account.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-semibold">Symbol</th>
                    <th className="pb-2 font-semibold text-right">Qty</th>
                    <th className="pb-2 font-semibold text-right">Avg Entry</th>
                    <th className="pb-2 font-semibold text-right">Current Price</th>
                    <th className="pb-2 font-semibold text-right">Market Value</th>
                    <th className="pb-2 font-semibold text-right">Open P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {positions.map((pos) => {
                    const isPos = pos.openPnl >= 0;
                    return (
                      <tr key={pos.symbolId} className="hover:bg-slate-50">
                        <td className="py-3 font-sans">
                          <span className="font-bold text-slate-900">{pos.symbol}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">ID: {pos.symbolId}</span>
                        </td>
                        <td className="py-3 text-right font-medium text-slate-800">{pos.openQuantity}</td>
                        <td className="py-3 text-right text-slate-600">${pos.averageEntryPrice.toFixed(2)}</td>
                        <td className="py-3 text-right text-slate-900 font-semibold">${pos.currentPrice.toFixed(2)}</td>
                        <td className="py-3 text-right text-slate-900 font-semibold">
                          ${pos.currentMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`py-3 text-right font-semibold ${isPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isPos ? '+' : ''}${pos.openPnl.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : subTab === 'balances' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {balances?.perCurrencyBalances.map((b) => (
                <div key={b.currency} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-900 text-sm">{b.currency} Balance</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {b.isRealTime ? 'Real-Time' : 'SOD'}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Cash:</span>
                      <span className="font-semibold text-slate-900">${b.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Market Value:</span>
                      <span className="font-semibold text-slate-900">${b.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                      <span className="font-sans">Total Equity:</span>
                      <span>${b.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-blue-700">
                      <span className="font-sans text-slate-500">Buying Power:</span>
                      <span className="font-semibold">${b.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : subTab === 'orders' ? (
            orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No orders found.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-semibold">Order ID</th>
                    <th className="pb-2 font-semibold">Symbol</th>
                    <th className="pb-2 font-semibold">Side</th>
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold text-right">Qty</th>
                    <th className="pb-2 font-semibold text-right">Limit Price</th>
                    <th className="pb-2 font-semibold">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="py-3 text-slate-500 font-mono">{ord.id}</td>
                      <td className="py-3 font-bold text-slate-900 font-sans">{ord.symbol}</td>
                      <td className={`py-3 font-semibold ${ord.side === 'Buy' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {ord.side}
                      </td>
                      <td className="py-3 text-slate-700">{ord.orderType}</td>
                      <td className="py-3 text-right text-slate-800">{ord.totalQuantity}</td>
                      <td className="py-3 text-right text-slate-900">
                        {ord.limitPrice ? `$${ord.limitPrice.toFixed(2)}` : 'Market'}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ord.state === 'Executed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.state === 'Accepted'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {ord.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : subTab === 'executions' ? (
            executions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No executions recorded.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-semibold">Time</th>
                    <th className="pb-2 font-semibold">Symbol</th>
                    <th className="pb-2 font-semibold">Side</th>
                    <th className="pb-2 font-semibold text-right">Price</th>
                    <th className="pb-2 font-semibold text-right">Total Cost</th>
                    <th className="pb-2 font-semibold text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {executions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-50">
                      <td className="py-3 text-slate-500 text-[11px] font-sans">
                        {new Date(exec.executionTime).toLocaleString()}
                      </td>
                      <td className="py-3 font-bold text-slate-900 font-sans">{exec.symbol}</td>
                      <td className={`py-3 font-semibold ${exec.side === 'Buy' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {exec.side}
                      </td>
                      <td className="py-3 text-right text-slate-900 font-semibold">${exec.price.toFixed(2)}</td>
                      <td className="py-3 text-right text-slate-900">${exec.totalCost.toFixed(2)}</td>
                      <td className="py-3 text-right text-slate-500">${exec.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            activities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No activities recorded.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Action</th>
                    <th className="pb-2 font-semibold">Description</th>
                    <th className="pb-2 font-semibold text-right">Net Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {activities.map((act, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 text-slate-500 font-sans text-[11px]">
                        {new Date(act.tradeDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 font-bold text-slate-800 font-sans">{act.action}</td>
                      <td className="py-3 text-slate-600 font-sans">{act.description}</td>
                      <td className={`py-3 text-right font-semibold ${act.netAmount >= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                        ${act.netAmount.toFixed(2)} {act.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
};
