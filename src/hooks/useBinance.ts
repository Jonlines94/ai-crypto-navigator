import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export function useBinance() {
  const [balances, setBalances] = useState<BinanceBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callBinance = useCallback(async (action: string, params?: Record<string, any>) => {
    const { data, error: fnError } = await supabase.functions.invoke("binance-api", {
      body: { action, params },
    });
    if (fnError) throw new Error(fnError.message);
    if (!data?.success) throw new Error(data?.error || "Binance request failed");
    return data.data;
  }, []);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callBinance("balances");
      setBalances(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
    } finally {
      setLoading(false);
    }
  }, [callBinance]);

  const executeOrder = useCallback(async (params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT";
    quantity: string;
    price?: string;
    maxTradeUsd?: number;
    testOnly?: boolean;
  }) => {
    const action = params.testOnly ? "test_order" : "order";
    return callBinance(action, {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      price: params.price,
      maxTradeUsd: String(params.maxTradeUsd || 100),
    });
  }, [callBinance]);

  return { balances, loading, error, fetchBalances, executeOrder, callBinance };
}
