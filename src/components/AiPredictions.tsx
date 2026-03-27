import { motion } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import type { AiPrediction } from "@/hooks/useAiPredictions";

interface AiPredictionsProps {
  predictions: AiPrediction[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const parsePrice = (s: string) => parseFloat(s.replace(/[$,]/g, ""));

const AiPredictions = ({ predictions = [], loading, error, onRefresh }: AiPredictionsProps) => {
  const actionIcon = (action: string) => {
    if (action === "BUY") return <TrendingUp className="w-3 h-3" />;
    if (action === "SELL") return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const actionColor = (action: string) => {
    if (action === "BUY") return { text: "text-gain", bg: "bg-gain/15", border: "border-gain/20 hover:border-gain/40", bar: "bg-gain" };
    if (action === "SELL") return { text: "text-loss", bg: "bg-loss/15", border: "border-loss/20 hover:border-loss/40", bar: "bg-loss" };
    return { text: "text-warning", bg: "bg-warning/15", border: "border-warning/20 hover:border-warning/40", bar: "bg-warning" };
  };

  // Sort: highest confidence first, BUY before SELL before HOLD
  const sorted = [...predictions].sort((a, b) => {
    const order = { BUY: 0, SELL: 1, HOLD: 2 };
    if (order[a.action] !== order[b.action]) return order[a.action] - order[b.action];
    return b.confidence - a.confidence;
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary animate-pulse-glow" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              All AI Signals
            </h2>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-mono text-primary font-semibold">LIVE</span>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing..." : "Refresh Predictions"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-loss/10 border border-loss/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-loss" />
          <span className="text-xs text-loss">{error}</span>
        </div>
      )}

      {loading && predictions.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-5 w-16 bg-secondary rounded" />
                <div className="h-5 w-12 bg-secondary rounded" />
              </div>
              <div className="h-2 w-full bg-secondary rounded mb-3" />
              <div className="h-12 w-full bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {sorted.map((pred, i) => {
            const colors = actionColor(pred.action);
            const current = parsePrice(pred.current);
            const target = parsePrice(pred.target);
            const pctMove = current && target ? ((target - current) / current) * 100 : 0;
            const isPositive = pctMove >= 0;

            // Price position bar: where current sits between low bound and target
            const rangeLow = Math.min(current, target) * 0.97;
            const rangeHigh = Math.max(current, target) * 1.03;
            const currentPos = ((current - rangeLow) / (rangeHigh - rangeLow)) * 100;
            const targetPos = ((target - rangeLow) / (rangeHigh - rangeLow)) * 100;

            return (
              <motion.div
                key={pred.symbol}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-card border rounded-lg p-4 ${colors.border} transition-colors`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-foreground">{pred.symbol}</span>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-bold ${colors.bg} ${colors.text}`}>
                    {actionIcon(pred.action)}
                    {pred.action}
                  </div>
                </div>

                {/* Prices row */}
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-sm font-mono text-foreground">{pred.current}</span>
                  <span className="text-[10px] text-muted-foreground mx-1">→</span>
                  <span className={`text-sm font-mono font-semibold ${colors.text}`}>{pred.target}</span>
                  <span className={`text-xs font-mono font-bold ml-auto ${isPositive ? "text-gain" : "text-loss"}`}>
                    {isPositive ? "+" : ""}{pctMove.toFixed(1)}%
                  </span>
                </div>

                {/* Price target visual bar */}
                <div className="relative h-6 mb-3">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-secondary rounded-full" />
                  {/* Current price marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${Math.max(5, Math.min(95, currentPos))}%` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-foreground border-2 border-card" />
                  </div>
                  {/* Target marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${Math.max(5, Math.min(95, targetPos))}%` }}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full border-2 border-card ${colors.bar}`} />
                  </div>
                  {/* Range fill between current and target */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-1 rounded-full ${colors.bar} opacity-40`}
                    style={{
                      left: `${Math.max(5, Math.min(currentPos, targetPos))}%`,
                      width: `${Math.abs(targetPos - currentPos)}%`,
                    }}
                  />
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pred.confidence}%` }}
                      transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                      className={`h-full rounded-full ${colors.bar}`}
                    />
                  </div>
                  <span className={`text-[11px] font-mono font-bold ${colors.text}`}>{pred.confidence}%</span>
                </div>

                {/* Reasoning */}
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-border/50 line-clamp-3">
                  {pred.reasoning}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AiPredictions;
