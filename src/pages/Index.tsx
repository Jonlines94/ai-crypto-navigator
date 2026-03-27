import { useEffect } from "react";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import TopPicksBanner from "@/components/TopPicksBanner";
import MarketSentiment from "@/components/MarketSentiment";
import TrendingInsights from "@/components/TrendingInsights";
import AiPredictions from "@/components/AiPredictions";
import ExchangeFlows from "@/components/ExchangeFlows";
import TransfersFeed from "@/components/TransfersFeed";
import { useCryptoData } from "@/hooks/useCryptoData";
import { useAiPredictions } from "@/hooks/useAiPredictions";

const Index = () => {
  const { coins, loading: coinsLoading, lastUpdated } = useCryptoData(30000);
  const { predictions, loading: aiLoading, error: aiError, generatePredictions } = useAiPredictions();

  useEffect(() => {
    if (coins.length > 0 && predictions.length === 0 && !aiLoading) {
      generatePredictions(coins);
    }
  }, [coins]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TickerBar coins={coins} loading={coinsLoading} />
      {lastUpdated && (
        <div className="max-w-[1440px] mx-auto px-4 pt-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
          <span className="text-[10px] font-mono text-muted-foreground">
            Live data · Updated {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      )}
      <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-8">
        {/* Hero: Top Buy & Sell picks */}
        <TopPicksBanner predictions={predictions} />

        {/* Sentiment gauge + AI summary + Profit simulator */}
        <MarketSentiment coins={coins} predictions={predictions} />

        {/* All AI predictions with price target bars */}
        <AiPredictions
          predictions={predictions}
          loading={aiLoading}
          error={aiError}
          onRefresh={() => generatePredictions(coins)}
        />

        <TrendingInsights coins={coins} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ExchangeFlows coins={coins} loading={coinsLoading} />
          <TransfersFeed />
        </div>
      </main>
    </div>
  );
};

export default Index;
