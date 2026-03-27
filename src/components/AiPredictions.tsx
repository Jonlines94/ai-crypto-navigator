import { motion } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import type { AiPrediction } from "@/hooks/useAiPredictions";

interface AiPredictionsProps {
  predictions: AiPrediction[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

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

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary animate-pulse-glow" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              AI Predictions
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
          {loading ? "Analyzing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-loss/10 border border-loss/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-loss" />
          <span className="text-xs text-loss">{error}</span>
        </div>
      )}

      {loading && predictions.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-5 w-16 bg-secondary rounded" />
                <div className="h-5 w-12 bg-secondary rounded" />
              </div>
              <div className="h-2 w-full bg-secondary rounded mb-3" />
              <div className="h-3 w-24 bg-secondary rounded mb-2" />
              <div className="h-8 w-full bg-secondary rounded mt-3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {predictions.map((pred, i) => {
            const colors = actionColor(pred.action);
            return (
              <motion.div
                key={pred.symbol}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`bg-card border rounded-lg p-4 ${colors.border} transition-colors cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{pred.symbol}</span>
                    <span className="text-xs font-mono text-muted-foreground">{pred.current}</span>
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded font-mono text-xs font-bold ${colors.bg} ${colors.text}`}>
                    {actionIcon(pred.action)}
                    {pred.action}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Confidence</div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pred.confidence}%` }}
                        transition={{ delay: i * 0.08 + 0.3, duration: 0.6 }}
                        className={`h-full rounded-full ${colors.bar}`}
                      />
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-bold ${colors.text}`}>{pred.confidence}%</span>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Target</span>
                  <span className={`text-sm font-mono font-semibold ${colors.text}`}>{pred.target}</span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border/50">
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
