import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CoinData } from "./useCryptoData";

export interface AiPrediction {
  asset: string;
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  target: string;
  current: string;
  reasoning: string;
}

export function useAiPredictions() {
  const [predictions, setPredictions] = useState<AiPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePredictions = useCallback(async (coins: CoinData[]) => {
    if (coins.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const top8 = coins.slice(0, 8).map((c) => ({
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        price: c.current_price,
        change24h: c.price_change_percentage_24h?.toFixed(2),
        marketCap: c.market_cap,
        volume: c.total_volume,
        high24h: c.high_24h,
        low24h: c.low_24h,
      }));

      const { data, error: fnError } = await supabase.functions.invoke("crypto-predictions", {
        body: { coins: top8 },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.predictions) {
        setPredictions(data.predictions);
      }
    } catch (err) {
      console.error("AI prediction error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate predictions");
    } finally {
      setLoading(false);
    }
  }, []);

  return { predictions, loading, error, generatePredictions };
}
