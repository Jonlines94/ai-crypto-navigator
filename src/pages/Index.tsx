import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import TopPicksBanner from "@/components/TopPicksBanner";
import MarketSentiment from "@/components/MarketSentiment";
import TrendingInsights from "@/components/TrendingInsights";
import AiPredictions from "@/components/AiPredictions";
import ExchangeFlows from "@/components/ExchangeFlows";
import TransfersFeed from "@/components/TransfersFeed";
import TradingDashboard from "@/components/TradingDashboard";
import { useCryptoData } from "@/hooks/useCryptoData";
import { useAiPredictions } from "@/hooks/useAiPredictions";
import { useBinance } from "@/hooks/useBinance";
import { useTradeSignals } from "@/hooks/useTradeSignals";
import { Bot, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { coins, loading: coinsLoading, lastUpdated } = useCryptoData(30000);
  const { predictions, loading: aiLoading, error: aiError, generatePredictions } = useAiPredictions();
  const { balances, accountValue, loading: balancesLoading, fetchBalances, executeOrder, fetchAllTickers } = useBinance();
  const {
    signals, marketOutlook, loading: signalsLoading, error: signalsError,
    settings, tradeHistory, updateSettings, generateSignals, updateSignalStatus,
  } = useTradeSignals();

  const [activeTab, setActiveTab] = useState<"intel" | "trading">("intel");

  useEffect(() => {
    if (coins.length > 0 && predictions.length === 0 && !aiLoading) {
      generatePredictions(coins);
    }
  }, [coins]);

  const handleApprove = useCallback(async (signal: any) => {
    try {
      if (settings.mode === "paper") {
        // Paper trade — just log it
        updateSignalStatus(signal.id, "executed", { paper: true, timestamp: new Date().toISOString() });
        toast.success(`📝 Paper trade: ${signal.side} ${signal.quantity} ${signal.symbol}`);
      } else {
        // Live trade
        const result = await executeOrder({
          symbol: signal.symbol,
          side: signal.side,
          type: signal.type,
          quantity: signal.quantity,
          price: signal.limitPrice,
          maxTradeUsd: settings.maxTradeUsd,
        });
        updateSignalStatus(signal.id, "executed", result);
        toast.success(`✅ Trade executed: ${signal.side} ${signal.quantity} ${signal.symbol}`);
      }
    } catch (err) {
      updateSignalStatus(signal.id, "failed", { error: err instanceof Error ? err.message : "Unknown error" });
      toast.error(`❌ Trade failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [settings, executeOrder, updateSignalStatus]);

  const handleReject = useCallback((id: string) => {
    updateSignalStatus(id, "rejected");
    toast.info("Trade signal skipped");
  }, [updateSignalStatus]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TickerBar coins={coins} loading={coinsLoading} />

      {/* Tab Navigation */}
      <div className="max-w-[1440px] mx-auto px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            <button
              onClick={() => setActiveTab("intel")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "intel"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Market Intel
            </button>
            <button
              onClick={() => setActiveTab("trading")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "trading"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="w-4 h-4" />
              Trading Bot
              {signals.length > 0 && (
                <span className="ml-1 bg-gain/20 text-gain text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">
                  {signals.length}
                </span>
              )}
            </button>
          </div>

          {lastUpdated && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground">
                Live · {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-8">
        {activeTab === "intel" ? (
          <>
            <TopPicksBanner predictions={predictions} />
            <MarketSentiment coins={coins} predictions={predictions} />
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
          </>
        ) : (
          <TradingDashboard
            signals={signals}
            marketOutlook={marketOutlook}
            loading={signalsLoading}
            error={signalsError}
            settings={settings}
            tradeHistory={tradeHistory}
            accountValue={accountValue}
            balances={balances}
            balancesLoading={balancesLoading}
            onGenerateSignals={() => generateSignals(coins, balances)}
            onUpdateSettings={updateSettings}
            onApprove={handleApprove}
            onReject={handleReject}
            onFetchBalances={fetchBalances}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
