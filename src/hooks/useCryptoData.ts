import { useState, useEffect, useCallback } from "react";

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  image: string;
  high_24h: number;
  low_24h: number;
  ath: number;
  circulating_supply: number;
}

const COIN_IDS = [
  "bitcoin", "ethereum", "solana", "binancecoin", "ripple",
  "avalanche-2", "dogecoin", "chainlink", "cardano", "polkadot",
  "polygon", "tron", "shiba-inu", "uniswap", "pepe",
];

const formatPrice = (price: number) => {
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
};

const formatMarketCap = (mc: number) => {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(2)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(2)}M`;
  return `$${mc.toLocaleString()}`;
};

const formatVolume = (v: number) => formatMarketCap(v);

export function useCryptoData(refreshInterval = 30000) {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS.join(",")}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
      const data: CoinData[] = await res.json();
      setCoins(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to fetch crypto data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { coins, loading, error, lastUpdated, refetch: fetchData };
}

export { formatPrice, formatMarketCap, formatVolume };
