import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CoinData } from "./useCryptoData";
import type { BinanceBalance } from "./useBinance";

export interface TradeSignal {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  limitPrice?: string;
  stopLoss: string;
  takeProfit: string;
  confidence: number;
  reasoning: string;
  estimatedValueUsd: string;
  riskRewardRatio: string;
  status: "pending" | "approved" | "executed" | "rejected" | "failed";
  executedAt?: string;
  executionResult?: any;
}

export interface ActiveTrade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
  paper: boolean;
}

export interface TradingSettings {
  mode: "paper" | "live";
  accountBalance: number;
  maxTradePercent: number;
  riskLevel: "conservative" | "medium" | "aggressive";
  stopLossPct: number;
  takeProfitPct: number;
  requireApproval: boolean;
  autoCloseOnTarget: boolean;
}

const DEFAULT_SETTINGS: TradingSettings = {
  mode: "paper",
  accountBalance: 300,
  maxTradePercent: 10,
  riskLevel: "medium",
  stopLossPct: 5,
  takeProfitPct: 10,
  requireApproval: true,
  autoCloseOnTarget: true,
};

export function useTradeSignals(onAutoClose?: (trade: ActiveTrade) => void) {
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>(() => {
    const saved = localStorage.getItem("active-trades");
    return saved ? JSON.parse(saved) : [];
  });
  const [marketOutlook, setMarketOutlook] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<TradingSettings>(() => {
    const saved = localStorage.getItem("trading-settings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const [tradeHistory, setTradeHistory] = useState<TradeSignal[]>(() => {
    const saved = localStorage.getItem("trade-history");
    return saved ? JSON.parse(saved) : [];
  });
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onAutoCloseRef = useRef(onAutoClose);
  onAutoCloseRef.current = onAutoClose;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Persist active trades
  useEffect(() => {
    localStorage.setItem("active-trades", JSON.stringify(activeTrades));
  }, [activeTrades]);

  // Internal close helper (used by auto-close and manual close)
  const closeTradeInternal = useCallback((tradeId: string, reason: string) => {
    setActiveTrades(prev => {
      const trade = prev.find(t => t.id === tradeId);
      if (trade) {
        const historyEntry: TradeSignal = {
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          type: "MARKET",
          quantity: trade.quantity,
          stopLoss: `$${trade.stopLoss}`,
          takeProfit: `$${trade.takeProfit}`,
          confidence: 0,
          reasoning: `${reason}. P&L: $${trade.pnl} (${trade.pnlPercent}%)`,
          estimatedValueUsd: `$${Math.abs(trade.currentPrice * parseFloat(trade.quantity)).toFixed(2)}`,
          riskRewardRatio: "—",
          status: "executed",
          executedAt: new Date().toISOString(),
          executionResult: { closedAt: trade.currentPrice, pnl: trade.pnl, pnlPercent: trade.pnlPercent, paper: trade.paper, reason },
        };
        setTradeHistory(hist => {
          const newHist = [historyEntry, ...hist].slice(0, 50);
          localStorage.setItem("trade-history", JSON.stringify(newHist));
          return newHist;
        });
      }
      return prev.filter(t => t.id !== tradeId);
    });
  }, []);

  // Poll live prices and auto-close on SL/TP
  useEffect(() => {
    if (activeTrades.length === 0) {
      if (priceIntervalRef.current) { clearInterval(priceIntervalRef.current); priceIntervalRef.current = null; }
      return;
    }

    const updatePrices = async () => {
      try {
        const symbols = [...new Set(activeTrades.map(t => t.symbol))];
        if (symbols.length === 0) return;
        
        // Batch: fetch all prices in one call instead of per-symbol
        const { data } = await supabase.functions.invoke("binance-proxy", {
          body: { action: "price" },
        });
        const prices: Record<string, number> = {};
        if (data?.success && Array.isArray(data.data)) {
          for (const p of data.data) {
            if (symbols.includes(p.symbol)) prices[p.symbol] = parseFloat(p.price);
          }
        }

        setActiveTrades(prev => {
          const tradesToClose: { trade: ActiveTrade; reason: string }[] = [];

          const updated = prev.map(trade => {
            const cp = prices[trade.symbol] ?? trade.currentPrice;
            const qty = parseFloat(trade.quantity);
            const pnl = trade.side === "BUY"
              ? (cp - trade.entryPrice) * qty
              : (trade.entryPrice - cp) * qty;
            const pnlPercent = trade.side === "BUY"
              ? ((cp - trade.entryPrice) / trade.entryPrice) * 100
              : ((trade.entryPrice - cp) / trade.entryPrice) * 100;

            const updatedTrade = { ...trade, currentPrice: cp, pnl: Math.round(pnl * 100) / 100, pnlPercent: Math.round(pnlPercent * 100) / 100 };

            // Check SL/TP auto-close
            if (settingsRef.current.autoCloseOnTarget) {
              if (trade.side === "BUY") {
                if (cp >= trade.takeProfit) tradesToClose.push({ trade: updatedTrade, reason: "Take-profit hit ✅" });
                else if (cp <= trade.stopLoss) tradesToClose.push({ trade: updatedTrade, reason: "Stop-loss hit 🛑" });
              } else {
                if (cp <= trade.takeProfit) tradesToClose.push({ trade: updatedTrade, reason: "Take-profit hit ✅" });
                else if (cp >= trade.stopLoss) tradesToClose.push({ trade: updatedTrade, reason: "Stop-loss hit 🛑" });
              }
            }

            return updatedTrade;
          });

          // Auto-close triggered trades
          if (tradesToClose.length > 0) {
            for (const { trade, reason } of tradesToClose) {
              onAutoCloseRef.current?.(trade);
              // Schedule closing outside this setState
              setTimeout(() => closeTradeInternal(trade.id, reason), 0);
            }
          }

          return updated;
        });
      } catch (e) { console.error("Price poll error:", e); }
    };

    updatePrices();
    priceIntervalRef.current = setInterval(updatePrices, 15000);
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [activeTrades.length, closeTradeInternal]);

  const updateSettings = useCallback((updates: Partial<TradingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("trading-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const generateSignals = useCallback(async (coins: CoinData[], portfolio: BinanceBalance[], totalBalanceUsd?: number) => {
    setLoading(true);
    setError(null);
    try {
      const coinData = coins.slice(0, 10).map((c) => ({
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        price: c.current_price,
        change24h: c.price_change_percentage_24h?.toFixed(2),
        marketCap: c.market_cap,
        volume: c.total_volume,
        high24h: c.high_24h,
        low24h: c.low_24h,
      }));

      // Fetch ALL Binance USDT tickers for full market scanning
      let binanceTickers: any[] = [];
      try {
        const { data: tickerData } = await supabase.functions.invoke("binance-proxy", {
          body: { action: "all_tickers" },
        });
        if (tickerData?.success) binanceTickers = tickerData.data; // Send ALL tickers, not just top 30
      } catch (e) { console.error("Failed to fetch tickers:", e); }

      const { data, error: fnError } = await supabase.functions.invoke("trade-signals", {
        body: {
          coins: coinData,
          binanceTickers,
          portfolio: portfolio.length > 0 ? portfolio : undefined,
          activeTrades: activeTrades.length > 0 ? activeTrades : undefined,
          settings: {
            maxTradeUsd: settings.accountBalance * (settings.maxTradePercent / 100),
            riskLevel: settings.riskLevel,
            stopLossPct: settings.stopLossPct,
            takeProfitPct: settings.takeProfitPct,
            totalBalanceUsd: totalBalanceUsd || settings.accountBalance,
          },
        },
      });

      if (fnError) throw new Error(fnError.message);

      if (data?.trades) {
        const newSignals: TradeSignal[] = data.trades.map((t: any, i: number) => ({
          ...t,
          id: `${Date.now()}-${i}`,
          status: "pending" as const,
        }));
        setSignals(newSignals);
      }
      if (data?.marketOutlook) setMarketOutlook(data.marketOutlook);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate signals");
    } finally {
      setLoading(false);
    }
  }, [settings, activeTrades]);

  const openTrade = useCallback((signal: TradeSignal, entryPrice: number, paper: boolean) => {
    const newTrade: ActiveTrade = {
      id: `trade-${Date.now()}`,
      symbol: signal.symbol,
      side: signal.side,
      quantity: signal.quantity,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: parseFloat(signal.stopLoss.replace(/[^0-9.]/g, "")),
      takeProfit: parseFloat(signal.takeProfit.replace(/[^0-9.]/g, "")),
      pnl: 0,
      pnlPercent: 0,
      openedAt: new Date().toISOString(),
      paper,
    };
    setActiveTrades(prev => [newTrade, ...prev]);
  }, []);

  const closeTrade = useCallback((tradeId: string) => {
    closeTradeInternal(tradeId, "Closed manually");
  }, [closeTradeInternal]);

  const getMaxTradeAmount = useCallback(() => {
    return settings.accountBalance * (settings.maxTradePercent / 100);
  }, [settings.maxTradePercent, settings.accountBalance]);

  const clearAllData = useCallback(() => {
    setSignals([]);
    setActiveTrades([]);
    setTradeHistory([]);
    setMarketOutlook("");
    localStorage.removeItem("active-trades");
    localStorage.removeItem("trade-history");
  }, []);

  const updateSignalStatus = useCallback((id: string, status: TradeSignal["status"], result?: any) => {
    setSignals((prev) => {
      const updated = prev.map((s) =>
        s.id === id
          ? { ...s, status, executedAt: status === "executed" ? new Date().toISOString() : s.executedAt, executionResult: result }
          : s
      );
      const completed = updated.filter((s) => ["executed", "rejected", "failed"].includes(s.status));
      if (completed.length > 0) {
        setTradeHistory((hist) => {
          const newHist = [...completed, ...hist].slice(0, 50);
          localStorage.setItem("trade-history", JSON.stringify(newHist));
          return newHist;
        });
      }
      return updated.filter((s) => !["executed", "rejected", "failed"].includes(s.status));
    });
  }, []);

  return {
    signals,
    activeTrades,
    marketOutlook,
    loading,
    error,
    settings,
    tradeHistory,
    updateSettings,
    generateSignals,
    updateSignalStatus,
    openTrade,
    closeTrade,
    getMaxTradeAmount,
    clearAllData,
  };
}
