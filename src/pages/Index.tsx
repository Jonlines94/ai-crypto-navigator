import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import TrendingInsights from "@/components/TrendingInsights";
import AiPredictions from "@/components/AiPredictions";
import ExchangeFlows from "@/components/ExchangeFlows";
import TransfersFeed from "@/components/TransfersFeed";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <TickerBar />
    <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-8">
      <AiPredictions />
      <TrendingInsights />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ExchangeFlows />
        <TransfersFeed />
      </div>
    </main>
  </div>
);

export default Index;
