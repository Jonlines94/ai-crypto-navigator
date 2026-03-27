import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Shield, ShieldAlert, TrendingUp, TrendingDown, Check, X,
  Play, Loader2, AlertTriangle, DollarSign, Settings, History,
} from "lucide-react";
import type { TradeSignal, TradingSettings } from "@/hooks/useTradeSignals";
import type { BinanceBalance } from "@/hooks/useBinance";

interface TradingDashboardProps {
  signals: TradeSignal[];
  marketOutlook: string;
  loading: boolean;
  error: string | null;
  settings: TradingSettings;
  tradeHistory: TradeSignal[];
  balances: BinanceBalance[];
  balancesLoading: boolean;
  onGenerateSignals: () => void;
  onUpdateSettings: (updates: Partial<TradingSettings>) => void;
  onApprove: (signal: TradeSignal) => void;
  onReject: (id: string) => void;
  onFetchBalances: () => void;
}

const TradingDashboard = ({
  signals = [],
  marketOutlook,
  loading,
  error,
  settings,
  tradeHistory = [],
  balances = [],
  balancesLoading,
  onGenerateSignals,
  onUpdateSettings,
  onApprove,
  onReject,
  onFetchBalances,
}: TradingDashboardProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmingTrade, setConfirmingTrade] = useState<string | null>(null);

  // P&L from history
  const totalTrades = tradeHistory.filter((t) => t.status === "executed").length;
  const recentTrades = tradeHistory.slice(0, 10);

  return (
    <section className="space-y-6">
      {/* Mode Banner */}
      <div className={`rounded-xl border p-4 flex items-center justify-between ${
        settings.mode === "live"
          ? "bg-loss/5 border-loss/30"
          : "bg-primary/5 border-primary/30"
      }`}>
        <div className="flex items-center gap-3">
          {settings.mode === "live" ? (
            <ShieldAlert className="w-6 h-6 text-loss" />
          ) : (
            <Shield className="w-6 h-6 text-primary" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${settings.mode === "live" ? "text-loss" : "text-primary"}`}>
                {settings.mode === "live" ? "⚡ LIVE TRADING" : "📝 PAPER TRADING"}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                settings.mode === "live" ? "bg-loss/20 text-loss" : "bg-primary/20 text-primary"
              }`}>
                {settings.mode === "live" ? "REAL MONEY" : "SIMULATED"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {settings.mode === "live"
                ? `Max $${settings.maxTradeUsd}/trade · ${settings.stopLossPct}% stop-loss · Approval ${settings.requireApproval ? "required" : "auto"}`
                : "No real money at risk. Switch to live when ready."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg bg-secondary/50"
          >
            <History className="w-3.5 h-3.5" />
            History ({totalTrades})
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg bg-secondary/50"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-xl p-5 space-y-4 overflow-hidden"
          >
            <h3 className="text-sm font-semibold text-foreground">Trading Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Mode</label>
                <select
                  value={settings.mode}
                  onChange={(e) => onUpdateSettings({ mode: e.target.value as "paper" | "live" })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="paper">Paper Trading (Simulated)</option>
                  <option value="live">Live Trading (Real Money)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Max Trade (USD)</label>
                <input
                  type="number"
                  value={settings.maxTradeUsd}
                  onChange={(e) => onUpdateSettings({ maxTradeUsd: Number(e.target.value) })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground"
                  min={10}
                  max={10000}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Risk Level</label>
                <select
                  value={settings.riskLevel}
                  onChange={(e) => onUpdateSettings({ riskLevel: e.target.value as any })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="conservative">Conservative</option>
                  <option value="medium">Medium</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Stop Loss %</label>
                <input
                  type="number"
                  value={settings.stopLossPct}
                  onChange={(e) => onUpdateSettings({ stopLossPct: Number(e.target.value) })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground"
                  min={1}
                  max={20}
                  step={0.5}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.requireApproval}
                onChange={(e) => onUpdateSettings({ requireApproval: e.target.checked })}
                className="rounded"
                id="require-approval"
              />
              <label htmlFor="require-approval" className="text-xs text-foreground">
                Require manual approval before executing trades
              </label>
            </div>
            {settings.mode === "live" && !settings.requireApproval && (
              <div className="flex items-center gap-2 p-2 bg-loss/10 border border-loss/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-loss" />
                <span className="text-xs text-loss">⚠️ Auto-execution is ON. Trades will execute immediately without confirmation!</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balances */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Binance Portfolio
          </h3>
          <button
            onClick={onFetchBalances}
            disabled={balancesLoading}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {balancesLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {balances.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {balances.map((b) => (
              <div key={b.asset} className="bg-secondary/50 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{b.asset}</span>
                <span className="text-sm font-mono text-muted-foreground">{parseFloat(b.free).toFixed(6)}</span>
                {parseFloat(b.locked) > 0 && (
                  <span className="text-[10px] font-mono text-warning">🔒 {parseFloat(b.locked).toFixed(6)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Click refresh to load your Binance balances</p>
        )}
      </div>

      {/* Market Outlook + Generate */}
      <div className="flex items-center justify-between">
        <div>
          {marketOutlook && (
            <p className="text-sm text-muted-foreground italic">📊 {marketOutlook}</p>
          )}
        </div>
        <button
          onClick={onGenerateSignals}
          disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          {loading ? "Analyzing Markets..." : "Generate Trade Signals"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-loss/10 border border-loss/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-loss" />
          <span className="text-xs text-loss">{error}</span>
        </div>
      )}

      {/* Trade Signals Queue */}
      {signals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Pending Signals ({signals.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {signals.map((signal, i) => (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-card border rounded-xl p-4 ${
                  signal.side === "BUY" ? "border-gain/30" : "border-loss/30"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {signal.side === "BUY" ? (
                      <TrendingUp className="w-5 h-5 text-gain" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-loss" />
                    )}
                    <span className="text-lg font-bold text-foreground">{signal.symbol}</span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      signal.side === "BUY" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
                    }`}>
                      {signal.side}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      {signal.type}
                    </span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${signal.confidence >= 70 ? "text-gain" : "text-warning"}`}>
                    {signal.confidence}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-mono text-foreground">{signal.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value</span>
                    <span className="font-mono text-foreground">{signal.estimatedValueUsd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stop Loss</span>
                    <span className="font-mono text-loss">{signal.stopLoss}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Take Profit</span>
                    <span className="font-mono text-gain">{signal.takeProfit}</span>
                  </div>
                  {signal.limitPrice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limit Price</span>
                      <span className="font-mono text-foreground">{signal.limitPrice}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk/Reward</span>
                    <span className="font-mono text-primary">{signal.riskRewardRatio}</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3 pb-3 border-b border-border/50">
                  {signal.reasoning}
                </p>

                {/* Actions */}
                {confirmingTrade === signal.id ? (
                  <div className="bg-loss/10 border border-loss/20 rounded-lg p-3">
                    <p className="text-xs text-loss font-semibold mb-2">
                      ⚠️ Confirm {settings.mode === "live" ? "LIVE" : "PAPER"} trade execution?
                    </p>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      {settings.mode === "live"
                        ? `This will execute a real ${signal.side} order for ${signal.quantity} ${signal.symbol} on Binance.`
                        : "This is a simulated trade. No real money will be used."}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onApprove(signal); setConfirmingTrade(null); }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gain/20 text-gain px-3 py-1.5 rounded text-xs font-semibold hover:bg-gain/30 transition-colors"
                      >
                        <Check className="w-3 h-3" /> Execute
                      </button>
                      <button
                        onClick={() => setConfirmingTrade(null)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-secondary text-muted-foreground px-3 py-1.5 rounded text-xs hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingTrade(signal.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                        signal.side === "BUY"
                          ? "bg-gain/15 text-gain hover:bg-gain/25"
                          : "bg-loss/15 text-loss hover:bg-loss/25"
                      }`}
                    >
                      <Play className="w-3 h-3" />
                      {settings.mode === "live" ? "Execute Trade" : "Paper Trade"}
                    </button>
                    <button
                      onClick={() => onReject(signal.id)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-loss bg-secondary/50 hover:bg-loss/10 transition-colors"
                    >
                      <X className="w-3 h-3" /> Skip
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Trade History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Trade History ({tradeHistory.length})
              </h3>
            </div>
            {recentTrades.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No trades yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-4 font-semibold">Time</th>
                      <th className="text-left py-2 px-4 font-semibold">Pair</th>
                      <th className="text-left py-2 px-4 font-semibold">Side</th>
                      <th className="text-right py-2 px-4 font-semibold">Qty</th>
                      <th className="text-right py-2 px-4 font-semibold">Value</th>
                      <th className="text-right py-2 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((t) => (
                      <tr key={t.id} className="border-b border-border/50 text-xs">
                        <td className="py-2 px-4 font-mono text-muted-foreground">
                          {t.executedAt ? new Date(t.executedAt).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 px-4 font-semibold text-foreground">{t.symbol}</td>
                        <td className="py-2 px-4">
                          <span className={`font-mono font-bold ${t.side === "BUY" ? "text-gain" : "text-loss"}`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="text-right py-2 px-4 font-mono text-foreground">{t.quantity}</td>
                        <td className="text-right py-2 px-4 font-mono text-foreground">{t.estimatedValueUsd}</td>
                        <td className="text-right py-2 px-4">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            t.status === "executed" ? "bg-gain/15 text-gain" :
                            t.status === "rejected" ? "bg-secondary text-muted-foreground" :
                            "bg-loss/15 text-loss"
                          }`}>
                            {t.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default TradingDashboard;
