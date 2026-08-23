import { motion } from "framer-motion";
import { Gem, RefreshCw, AlertCircle, Flame, TrendingUp, TrendingDown, Radar, ShieldAlert, BadgeCheck, Clock } from "lucide-react";
import type { EmergingCoin } from "@/hooks/useEmergingCoins";
import { formatPrice, formatMarketCap } from "@/hooks/useCryptoData";

interface EmergingCoinsProps {
  gems: EmergingCoin[];
  outlook: string | null;
  fallback: boolean;
  scannedCount: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  dataAsOf: Date | null;
  onRefresh: () => void;
}

const scoreColor = (s: number) =>
  s >= 80 ? "text-gain" : s >= 65 ? "text-primary" : "text-warning";

const scoreBarColor = (s: number) =>
  s >= 80 ? "bg-gain" : s >= 65 ? "bg-primary" : "bg-warning";

const riskStyles = (r: EmergingCoin["risk"]) => {
  if (r === "LOW") return "bg-gain/10 text-gain border-gain/20";
  if (r === "MEDIUM") return "bg-warning/10 text-warning border-warning/20";
  return "bg-loss/10 text-loss border-loss/20";
};

const ChangeBadge = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-end">
    <span className="text-[9px] font-mono text-muted-foreground uppercase">{label}</span>
    <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${value >= 0 ? "text-gain" : "text-loss"}`}>
      {value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  </div>
);

const EmergingCoins = ({ gems = [], outlook, fallback, scannedCount, loading, error, lastUpdated, dataAsOf, onRefresh }: EmergingCoinsProps) => {
  const verifiedCount = gems.filter(g => g.verified).length;
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-primary animate-pulse-glow" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Up &amp; Coming Gems
            </h2>
          </div>
          {scannedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Radar className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-mono text-primary font-semibold">
                {scannedCount} COINS SCANNED
              </span>
            </div>
          )}
          {verifiedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gain/10 border border-gain/20">
              <BadgeCheck className="w-3 h-3 text-gain" />
              <span className="text-[10px] font-mono text-gain font-semibold">
                {verifiedCount}/{gems.length} AI VERIFIED
              </span>
            </div>
          )}
          {fallback && (
            <span className="text-[10px] font-mono text-warning px-2 py-1 rounded-full bg-warning/10 border border-warning/20">
              HEURISTIC MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dataAsOf && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hidden sm:flex">
              <Clock className="w-3 h-3" />
              Data as of {dataAsOf.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Verifying..." : "Rescan"}
          </button>
        </div>
      </div>

      {outlook && (
        <div className="mb-4 p-3 bg-card border border-border rounded-lg flex items-start gap-2">
          <Radar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{outlook}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-loss/10 border border-loss/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-loss" />
          <span className="text-xs text-loss">{error}</span>
        </div>
      )}

      {loading && gems.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-6 w-24 bg-secondary rounded" />
                <div className="h-6 w-12 bg-secondary rounded" />
              </div>
              <div className="h-2 w-full bg-secondary rounded mb-3" />
              <div className="h-14 w-full bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : gems.length === 0 && !error ? (
        <div className="p-8 text-center bg-card border border-border rounded-lg">
          <Gem className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No gems found yet — hit Rescan to search the market.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {gems.map((gem, i) => (
            <motion.div
              key={gem.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src={gem.image} alt={gem.name} className="w-8 h-8 rounded-full" loading="lazy" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{gem.name}</span>
                      {gem.trending && (
                        <span className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded-full shrink-0">
                          <Flame className="w-2.5 h-2.5" />
                          HOT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {gem.symbol}{gem.rank ? ` · #${gem.rank}` : ""}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xl font-mono font-bold ${scoreColor(gem.potentialScore)}`}>
                    {gem.potentialScore}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground uppercase">Potential</div>
                  {gem.verified && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold text-gain mt-0.5">
                      <BadgeCheck className="w-3 h-3" />
                      VERIFIED
                    </span>
                  )}
                </div>
              </div>

              {/* Score bar */}
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${gem.potentialScore}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                  className={`h-full rounded-full ${scoreBarColor(gem.potentialScore)}`}
                />
              </div>

              {/* Price + changes */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/50">
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase block">Price</span>
                  <span className="text-sm font-mono font-semibold text-foreground">{formatPrice(gem.price)}</span>
                </div>
                {gem.change1h != null && <ChangeBadge value={gem.change1h} label="1h" />}
                <ChangeBadge value={gem.change24h} label="24h" />
                <ChangeBadge value={gem.change7d} label="7d" />
              </div>

              {/* Market data */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase block">Market Cap</span>
                  <span className="text-xs font-mono text-foreground">{formatMarketCap(gem.marketCap)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground uppercase block">24h Volume</span>
                  <span className="text-xs font-mono text-foreground">{formatMarketCap(gem.volume)}</span>
                </div>
              </div>

              {/* AI reason */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{gem.reason}</p>

              {/* Verification note */}
              {gem.verificationNote && (
                <div className={`flex items-start gap-1.5 mb-3 p-2 rounded border text-[10px] font-mono leading-relaxed ${
                  gem.verified
                    ? "bg-gain/5 border-gain/20 text-gain"
                    : "bg-warning/5 border-warning/20 text-warning"
                }`}>
                  <BadgeCheck className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{gem.verificationNote}</span>
                </div>
              )}

              {/* Risk badge */}
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-1 rounded-full border ${riskStyles(gem.risk)}`}>
                  <ShieldAlert className="w-3 h-3" />
                  {gem.risk} RISK
                </span>
                <span className="text-[9px] font-mono text-muted-foreground uppercase">Not financial advice</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};

export default EmergingCoins;
