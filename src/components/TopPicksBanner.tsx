import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Zap, Target, DollarSign } from "lucide-react";
import type { AiPrediction } from "@/hooks/useAiPredictions";

interface TopPicksBannerProps {
  predictions: AiPrediction[];
}

const TopPicksBanner = ({ predictions = [] }: TopPicksBannerProps) => {
  if (predictions.length === 0) return null;

  const buys = predictions.filter((p) => p.action === "BUY").sort((a, b) => b.confidence - a.confidence);
  const sells = predictions.filter((p) => p.action === "SELL").sort((a, b) => b.confidence - a.confidence);

  const topBuy = buys[0];
  const topSell = sells[0];

  if (!topBuy && !topSell) return null;

  const parsePrice = (s: string) => parseFloat(s.replace(/[$,]/g, ""));
  const calcPct = (current: string, target: string) => {
    const c = parsePrice(current);
    const t = parsePrice(target);
    if (!c || !t) return 0;
    return ((t - c) / c) * 100;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {topBuy && (
        <div className="relative overflow-hidden rounded-xl border border-gain/30 bg-gradient-to-br from-gain/5 via-card to-card p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gain/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gain/20 border border-gain/30">
                <Zap className="w-3 h-3 text-gain" />
                <span className="text-[10px] font-mono font-bold text-gain uppercase">Top Buy Signal</span>
              </div>
              <span className="text-[10px] font-mono text-gain">{topBuy.confidence}% confidence</span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-bold text-foreground">{topBuy.symbol}</span>
              <span className="text-sm text-muted-foreground">{topBuy.asset}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Current</div>
                <div className="text-sm font-mono font-semibold text-foreground">{topBuy.current}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Target</div>
                <div className="text-sm font-mono font-semibold text-gain">{topBuy.target}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Potential</div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-gain" />
                  <span className="text-sm font-mono font-bold text-gain">
                    +{calcPct(topBuy.current, topBuy.target).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{topBuy.reasoning}</p>
          </div>
        </div>
      )}

      {topSell && (
        <div className="relative overflow-hidden rounded-xl border border-loss/30 bg-gradient-to-br from-loss/5 via-card to-card p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-loss/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-loss/20 border border-loss/30">
                <Target className="w-3 h-3 text-loss" />
                <span className="text-[10px] font-mono font-bold text-loss uppercase">Top Sell Signal</span>
              </div>
              <span className="text-[10px] font-mono text-loss">{topSell.confidence}% confidence</span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-bold text-foreground">{topSell.symbol}</span>
              <span className="text-sm text-muted-foreground">{topSell.asset}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Current</div>
                <div className="text-sm font-mono font-semibold text-foreground">{topSell.current}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Target</div>
                <div className="text-sm font-mono font-semibold text-loss">{topSell.target}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Risk</div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-loss" />
                  <span className="text-sm font-mono font-bold text-loss">
                    {calcPct(topSell.current, topSell.target).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{topSell.reasoning}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default TopPicksBanner;
