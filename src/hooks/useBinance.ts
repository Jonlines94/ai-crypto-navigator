import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface AccountValue {
  totalUsd: number;
  holdings: Array<{
    asset: string;
    free: string;
    locked: string;
    total: number;
    usdValue: number;
  }>;
}

export function useBinance() {
  const [balances, setBalances] = useState<BinanceBalance[]>([]);
  const [accountValue, setAccountValue] = useState<AccountValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callBinance = useCallback(async (action: string, params?: Record<string, any>) => {
    const { data, error: fnError } = await supabase.functions.invoke("binance-proxy", {
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
      const result = await callBinance("account_value");
      setAccountValue(result);
      setBalances(result.holdings.map((h: any) => ({ asset: h.asset, free: h.free, locked: h.locked })));
    } catch (err) {
      console.error("Binance error:", err);
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

  const fetchAllTickers = useCallback(async () => {
    return callBinance("all_tickers");
  }, [callBinance]);

  return { balances, accountValue, loading, error, fetchBalances, executeOrder, callBinance, fetchAllTickers };
}
