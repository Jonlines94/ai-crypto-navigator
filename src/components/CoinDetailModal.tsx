import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown, ExternalLink, Brain, Globe, FileSearch, Store } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { AiPrediction } from "@/hooks/useAiPredictions";

interface CoinDetailModalProps {
  coinId: string;
  predictions?: AiPrediction[];
  onClose: () => void;
}

interface CoinDetail {
  name: string;
  symbol: string;
  image: string;
  rank: number | null;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  marketCap: number;
  fdv: number;
  volume: number;
  high24h: number;
  low24h: number;
  ath: number;
  athChange: number;
  atl: number;
  atlChange: number;
  circulating: number;
  totalSupply: number | null;
  maxSupply: number | null;
  description: string;
  homepage: string | null;
  explorer: string | null;
}

interface MarketListing {
  exchange: string;
  exchangeLogo: string | null;
  pair: string;
  price: number;
  volume: number;
  trustScore: string | null;
  tradeUrl: string | null;
}

const fmtPrice = (p: number) => {
  if (!Number.isFinite(p)) return "—";
  if (p >= 1) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
};

const fmtBig = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
};

const fmtSupply = (v: number | null, symbol: string) => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B ${symbol}`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M ${symbol}`;
  return `${v.toLocaleString()} ${symbol}`;
};

const ChangeBadge = ({ label, value }: { label: string; value: number }) => {
  const positive = value >= 0;
  return (
    <div className="flex flex-col items-center bg-secondary/30 rounded-lg px-3 py-2 min-w-[70px]">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-bold ${positive ? "text-gain" : "text-loss"}`}>
        {positive ? "+" : ""}
        {Number.isFinite(value) ? value.toFixed(2) : "0.00"}%
      </span>
    </div>
  );
};

const CoinDetailModal = ({ coinId, predictions = [], onClose }: CoinDetailModalProps) => {
  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [chart, setChart] = useState<{ t: number; p: number }[]>([]);
  const [markets, setMarkets] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("coin-detail", {
          body: { id: coinId },
        });
        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);
        if (cancelled) return;

        setDetail(data.detail);
        if (Array.isArray(data.chart)) {
          setChart(data.chart.map(([t, p]: [number, number]) => ({ t, p })));
        }
        if (Array.isArray(data.markets)) {
          setMarkets(data.markets);
        }
      } catch (err) {
        console.error("Coin detail error:", err);
        if (!cancelled) setError("Failed to load coin data — CoinGecko may be rate limiting. Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [coinId]);

  const signal = detail
    ? predictions.find((p) => p.symbol.toUpperCase() === detail.symbol)
    : undefined;

  const chartUp = chart.length > 1 && chart[chart.length - 1].p >= chart[0].p;
  const chartColor = chartUp ? "hsl(var(--gain))" : "hsl(var(--loss))";

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">Loading coin data...</span>
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-sm text-loss mb-4">{error}</p>
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        ) : detail ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={detail.image} alt={detail.name} className="w-11 h-11 rounded-full" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">{detail.name}</h3>
                    {detail.rank && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        #{detail.rank}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{detail.symbol}</span>
                </div>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-bold font-mono text-foreground">{fmtPrice(detail.price)}</span>
              <span
                className={`flex items-center gap-1 text-sm font-mono font-semibold ${
                  detail.change24h >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {detail.change24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {detail.change24h.toFixed(2)}%
              </span>
            </div>

            {/* Change badges */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <ChangeBadge label="1h" value={detail.change1h} />
              <ChangeBadge label="24h" value={detail.change24h} />
              <ChangeBadge label="7d" value={detail.change7d} />
              <ChangeBadge label="30d" value={detail.change30d} />
            </div>

            {/* AI signal */}
            {signal && (
              <div
                className={`mb-4 rounded-lg border p-3 ${
                  signal.action === "BUY"
                    ? "border-gain/30 bg-gain/10"
                    : signal.action === "SELL"
                    ? "border-loss/30 bg-loss/10"
                    : "border-warning/30 bg-warning/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    AI Signal
                  </span>
                  <span
                    className={`ml-auto text-xs font-mono font-bold ${
                      signal.action === "BUY" ? "text-gain" : signal.action === "SELL" ? "text-loss" : "text-warning"
                    }`}
                  >
                    {signal.action} · {signal.confidence}%
                  </span>
                </div>
                {signal.verdict && (
                  <p className="text-xs font-semibold text-foreground mb-0.5">{signal.verdict}</p>
                )}
                <p className="text-[11px] text-muted-foreground leading-relaxed">{signal.reasoning}</p>
                <div className="flex gap-4 mt-2 text-[10px] font-mono text-muted-foreground">
                  <span>
                    Target <span className="text-gain">{signal.target}</span>
                  </span>
                  {signal.stopLoss && (
                    <span>
                      Stop <span className="text-loss">{signal.stopLoss}</span>
                    </span>
                  )}
                  {signal.timeframe && <span>{signal.timeframe}</span>}
                </div>
              </div>
            )}

            {/* 7d chart */}
            {chart.length > 1 && (
              <div className="mb-4 bg-secondary/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">7 Day Price</span>
                  <span className={`text-[10px] font-mono font-semibold ${chartUp ? "text-gain" : "text-loss"}`}>
                    {chartUp ? "▲" : "▼"} {(((chart[chart.length - 1].p - chart[0].p) / chart[0].p) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Area
                        type="monotone"
                        dataKey="p"
                        stroke={chartColor}
                        strokeWidth={1.5}
                        fill="url(#coinGrad)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm mb-4">
              {[
                ["Market Cap", fmtBig(detail.marketCap)],
                ["Fully Diluted", fmtBig(detail.fdv)],
                ["24h Volume", fmtBig(detail.volume)],
                ["24h High", fmtPrice(detail.high24h)],
                ["24h Low", fmtPrice(detail.low24h)],
                [
                  "All-Time High",
                  `${fmtPrice(detail.ath)} (${detail.athChange >= 0 ? "+" : ""}${detail.athChange.toFixed(0)}%)`,
                ],
                [
                  "All-Time Low",
                  `${fmtPrice(detail.atl)} (${detail.atlChange >= 0 ? "+" : ""}${detail.atlChange.toFixed(0)}%)`,
                ],
                ["Circulating", fmtSupply(detail.circulating, detail.symbol)],
                ["Max Supply", fmtSupply(detail.maxSupply, detail.symbol)],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-secondary/30 rounded-lg px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                  <div className="font-mono font-semibold text-foreground text-xs">{value}</div>
                </div>
              ))}
            </div>

            {/* Where to buy */}
            {markets.length > 0 && (
              <div className="mb-4 border-t border-border/50 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Where to Buy
                  </span>
                </div>
                <div className="space-y-1">
                  {markets.map((m, i) => {
                    const trustColor =
                      m.trustScore === "green"
                        ? "text-gain"
                        : m.trustScore === "yellow"
                        ? "text-warning"
                        : "text-muted-foreground";
                    const inner = (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          {m.exchangeLogo ? (
                            <img src={m.exchangeLogo} alt={m.exchange} className="w-4 h-4 rounded-full shrink-0" />
                          ) : (
                            <Store className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-foreground truncate">{m.exchange}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{m.pair}</span>
                          {m.trustScore === "green" && (
                            <span className={`w-1.5 h-1.5 rounded-full bg-gain shrink-0 ${trustColor}`} title="High trust" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-mono text-foreground">{fmtPrice(m.price)}</span>
                          <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">
                            {fmtBig(m.volume)}
                          </span>
                          {m.tradeUrl && <ExternalLink className="w-3 h-3 text-primary" />}
                        </div>
                      </>
                    );
                    return m.tradeUrl ? (
                      <a
                        key={i}
                        href={m.tradeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 bg-secondary/30 hover:bg-secondary/50 rounded-lg px-3 py-2 transition-colors"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={i} className="flex items-center justify-between gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {detail.description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-4 border-t border-border/50 pt-3">
                {detail.description}
                {detail.description.endsWith(".") ? "" : "."}
              </p>
            )}

            {/* Links */}
            {(detail.homepage || detail.explorer) && (
              <div className="flex gap-2 border-t border-border/50 pt-3">
                {detail.homepage && (
                  <a
                    href={detail.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-primary hover:text-primary/80 transition-colors"
                  >
                    <Globe className="w-3 h-3" /> Website <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {detail.explorer && (
                  <a
                    href={detail.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-primary hover:text-primary/80 transition-colors"
                  >
                    <FileSearch className="w-3 h-3" /> Explorer <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default CoinDetailModal;
