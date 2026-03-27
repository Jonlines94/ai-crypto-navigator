import { motion } from "framer-motion";
import { aiPredictions } from "@/data/mockCryptoData";
import { Brain, TrendingUp, TrendingDown, Sparkles } from "lucide-react";

const AiPredictions = () => (
  <section>
    <div className="flex items-center gap-3 mb-4">
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {aiPredictions.map((pred, i) => (
        <motion.div
          key={pred.asset}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className={`bg-card border rounded-lg p-4 ${
            pred.action === "BUY" ? "border-gain/20 hover:border-gain/40" : "border-loss/20 hover:border-loss/40"
          } transition-colors cursor-pointer`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">{pred.asset}</span>
              <span className="text-xs font-mono text-muted-foreground">{pred.current}</span>
            </div>
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded font-mono text-xs font-bold ${
              pred.action === "BUY" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
            }`}>
              {pred.action === "BUY" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
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
                  className={`h-full rounded-full ${pred.action === "BUY" ? "bg-gain" : "bg-loss"}`}
                />
              </div>
            </div>
            <span className={`text-sm font-mono font-bold ${pred.action === "BUY" ? "text-gain" : "text-loss"}`}>
              {pred.confidence}%
            </span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Target</span>
            <span className={`text-sm font-mono font-semibold ${pred.action === "BUY" ? "text-gain" : "text-loss"}`}>
              {pred.target}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border/50">
            {pred.reasoning}
          </p>
        </motion.div>
      ))}
    </div>
  </section>
);

export default AiPredictions;
