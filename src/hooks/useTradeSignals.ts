import { useState, useCallback } from "react";
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

export interface TradingSettings {
  mode: "paper" | "live";
  maxTradeUsd: number;
  riskLevel: "conservative" | "medium" | "aggressive";
  stopLossPct: number;
  requireApproval: boolean;
}

const DEFAULT_SETTINGS: TradingSettings = {
  mode: "paper",
  maxTradeUsd: 100,
  riskLevel: "medium",
  stopLossPct: 5,
  requireApproval: true,
};

export function useTradeSignals() {
  const [signals, setSignals] = useState<TradeSignal[]>([]);
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

  const updateSettings = useCallback((updates: Partial<TradingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("trading-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  const generateSignals = useCallback(async (coins: CoinData[], portfolio: BinanceBalance[]) => {
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

      const { data, error: fnError } = await supabase.functions.invoke("trade-signals", {
        body: {
          coins: coinData,
          portfolio: portfolio.length > 0 ? portfolio : undefined,
          settings: {
            maxTradeUsd: settings.maxTradeUsd,
            riskLevel: settings.riskLevel,
            stopLossPct: settings.stopLossPct,
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
  }, [settings]);

  const updateSignalStatus = useCallback((id: string, status: TradeSignal["status"], result?: any) => {
    setSignals((prev) => {
      const updated = prev.map((s) =>
        s.id === id
          ? { ...s, status, executedAt: status === "executed" ? new Date().toISOString() : s.executedAt, executionResult: result }
          : s
      );
      // Move completed signals to history
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
    marketOutlook,
    loading,
    error,
    settings,
    tradeHistory,
    updateSettings,
    generateSignals,
    updateSignalStatus,
  };
}
