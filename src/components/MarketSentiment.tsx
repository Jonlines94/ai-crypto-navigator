import { motion } from "framer-motion";
import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { CoinData } from "@/hooks/useCryptoData";
import type { AiPrediction } from "@/hooks/useAiPredictions";

interface MarketSentimentProps {
  coins: CoinData[];
  predictions: AiPrediction[];
}

const MarketSentiment = ({ coins = [], predictions = [] }: MarketSentimentProps) => {
  if (coins.length === 0) return null;

  // Calculate sentiment score 0-100
  const gainers = coins.filter((c) => (c.price_change_percentage_24h ?? 0) > 0).length;
  const avgChange = coins.reduce((acc, c) => acc + (c.price_change_percentage_24h ?? 0), 0) / coins.length;
  const marketScore = Math.min(100, Math.max(0, 50 + avgChange * 5));

  // AI signal breakdown
  const buys = predictions.filter((p) => p.action === "BUY").length;
  const sells = predictions.filter((p) => p.action === "SELL").length;
  const holds = predictions.filter((p) => p.action === "HOLD").length;
  const avgConfidence = predictions.length > 0
    ? Math.round(predictions.reduce((acc, p) => acc + p.confidence, 0) / predictions.length)
    : 0;

  const sentimentLabel = marketScore >= 70 ? "Extreme Greed" : marketScore >= 55 ? "Greed" : marketScore >= 45 ? "Neutral" : marketScore >= 30 ? "Fear" : "Extreme Fear";
  const sentimentColor = marketScore >= 55 ? "text-gain" : marketScore >= 45 ? "text-warning" : "text-loss";
  const gaugeColor = marketScore >= 55 ? "bg-gain" : marketScore >= 45 ? "bg-warning" : "bg-loss";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Sentiment Gauge */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Market Sentiment</h3>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
              <motion.circle
                cx="50" cy="50" r="40" fill="none"
                stroke={marketScore >= 55 ? "hsl(var(--gain))" : marketScore >= 45 ? "hsl(var(--warning))" : "hsl(var(--loss))"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${marketScore * 2.51} 251`}
                initial={{ strokeDasharray: "0 251" }}
                animate={{ strokeDasharray: `${marketScore * 2.51} 251` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold font-mono ${sentimentColor}`}>{Math.round(marketScore)}</span>
            </div>
          </div>
          <div>
            <div className={`text-lg font-bold ${sentimentColor}`}>{sentimentLabel}</div>
            <div className="text-xs text-muted-foreground">{gainers}/{coins.length} tokens green</div>
            <div className="text-xs text-muted-foreground">Avg: {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* AI Signal Summary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">AI Signals Summary</h3>
        </div>
        {predictions.length > 0 ? (
          <>
            <div className="space-y-2.5 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-gain" />
                  <span className="text-sm text-foreground">Buy Signals</span>
                </div>
                <span className="text-sm font-mono font-bold text-gain">{buys}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-loss" />
                  <span className="text-sm text-foreground">Sell Signals</span>
                </div>
                <span className="text-sm font-mono font-bold text-loss">{sells}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Minus className="w-3.5 h-3.5 text-warning" />
                  <span className="text-sm text-foreground">Hold Signals</span>
                </div>
                <span className="text-sm font-mono font-bold text-warning">{holds}</span>
              </div>
            </div>
            {/* Signal bar */}
            <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
              {buys > 0 && <div className="bg-gain h-full" style={{ width: `${(buys / predictions.length) * 100}%` }} />}
              {holds > 0 && <div className="bg-warning h-full" style={{ width: `${(holds / predictions.length) * 100}%` }} />}
              {sells > 0 && <div className="bg-loss h-full" style={{ width: `${(sells / predictions.length) * 100}%` }} />}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">Avg confidence: {avgConfidence}%</div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Loading AI signals...</div>
        )}
      </div>

      {/* Profit Calculator */}
      <ProfitCalculator predictions={predictions} />
    </div>
  );
};

const ProfitCalculator = ({ predictions = [] }: { predictions: AiPrediction[] }) => {
  const parsePrice = (s: string) => parseFloat(s.replace(/[$,]/g, ""));

  const buyPredictions = predictions.filter((p) => p.action === "BUY");

  if (buyPredictions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">💰</span>
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Profit Simulator</h3>
        </div>
        <p className="text-sm text-muted-foreground">Waiting for buy signals...</p>
      </div>
    );
  }

  const investPerCoin = 1000;
  const totalInvested = buyPredictions.length * investPerCoin;
  const totalAtTarget = buyPredictions.reduce((acc, p) => {
    const current = parsePrice(p.current);
    const target = parsePrice(p.target);
    if (!current || !target) return acc + investPerCoin;
    return acc + investPerCoin * (target / current);
  }, 0);
  const totalProfit = totalAtTarget - totalInvested;
  const totalPct = ((totalAtTarget - totalInvested) / totalInvested) * 100;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💰</span>
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Profit Simulator</h3>
      </div>
      <div className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wider">
        If you invested ${investPerCoin.toLocaleString()} in each AI Buy pick:
      </div>
      <div className="space-y-2">
        {buyPredictions.map((p) => {
          const current = parsePrice(p.current);
          const target = parsePrice(p.target);
          const pct = current && target ? ((target - current) / current) * 100 : 0;
          return (
            <div key={p.symbol} className="flex items-center justify-between text-xs">
              <span className="font-mono text-foreground">{p.symbol}</span>
              <span className="font-mono text-gain">+${((investPerCoin * pct) / 100).toFixed(0)} ({pct.toFixed(1)}%)</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Total Invested</div>
          <div className="text-sm font-mono font-semibold text-foreground">${totalInvested.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground uppercase">Potential Profit</div>
          <div className="text-sm font-mono font-bold text-gain">
            +${totalProfit.toFixed(0)} ({totalPct.toFixed(1)}%)
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketSentiment;
