import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmergingCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume: number;
  rank: number | null;
  potentialScore: number;
  reason: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  trending: boolean;
}

export function useEmergingCoins(autoRefreshMs = 300000) {
  const [gems, setGems] = useState<EmergingCoin[]>([]);
  const [outlook, setOutlook] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasFetched = useRef(false);

  const fetchGems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("emerging-coins", { body: {} });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setGems(data.gems ?? []);
      setOutlook(data.outlook ?? null);
      setFallback(!!data.fallback);
      setScannedCount(data.scannedCount ?? 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Emerging coins error:", err);
      setError(err instanceof Error ? err.message : "Failed to scan for emerging coins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchGems();
    const interval = setInterval(fetchGems, autoRefreshMs);
    return () => clearInterval(interval);
  }, [fetchGems, autoRefreshMs]);

  return { gems, outlook, fallback, scannedCount, loading, error, lastUpdated, refresh: fetchGems };
}
