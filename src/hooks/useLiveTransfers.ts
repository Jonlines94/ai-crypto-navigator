import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LargeTrade {
  id: string;
  symbol: string;
  base: string;
  price: number;
  quantity: number;
  usd: number;
  side: "BUY" | "SELL";
  time: number;
}

export function useLiveTransfers(refreshInterval = 15000) {
  const [trades, setTrades] = useState<LargeTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const fetchTrades = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("binance-proxy", {
        body: { action: "large_trades", params: { minUsd: "50000" } },
      });
      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Failed to fetch trades");

      const incoming: LargeTrade[] = data.data || [];
      const fresh = new Set<string>();
      for (const t of incoming) {
        if (!seenRef.current.has(t.id)) fresh.add(t.id);
      }
      seenRef.current = new Set(incoming.map((t) => t.id));
      setNewIds(fresh);
      setTrades(incoming);
      setError(null);
    } catch (err) {
      console.error("Live transfers error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTrades, refreshInterval]);

  return { trades, loading, error, newIds, refetch: fetchTrades };
}
