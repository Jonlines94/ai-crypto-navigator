import { useEffect, useState, useCallback, useRef } from "react";
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
  const handleAutoClose = useCallback((trade: any) => {
    // settings not available here yet, check trade.paper instead
    if (!trade.paper) {
      const closeSide = trade.side === "BUY" ? "SELL" : "BUY";
      executeOrder({ symbol: trade.symbol, side: closeSide as "BUY" | "SELL", type: "MARKET", quantity: trade.quantity, maxTradeUsd: 10000 })
        .then(() => toast.success(`🎯 Auto-closed ${trade.symbol}: ${trade.pnl >= 0 ? "Profit" : "Loss"} $${Math.abs(trade.pnl).toFixed(2)}`))
        .catch((err) => toast.error(`Failed to auto-close ${trade.symbol}: ${err.message}`));
    } else {
      toast.info(`🎯 Paper trade auto-closed ${trade.symbol}: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`);
    }
  }, [executeOrder]);

  const {
    signals, activeTrades, marketOutlook, loading: signalsLoading, error: signalsError,
    settings, tradeHistory, updateSettings, generateSignals, updateSignalStatus, openTrade, closeTrade, getMaxTradeAmount,
  } = useTradeSignals(handleAutoClose);

  const [activeTab, setActiveTab] = useState<"intel" | "trading">("intel");
  const [botActive, setBotActive] = useState(false);
  const botIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalsRef = useRef(signals);
  signalsRef.current = signals;
  const signalsLoadingRef = useRef(signalsLoading);
  signalsLoadingRef.current = signalsLoading;

  useEffect(() => {
    if (coins.length > 0 && predictions.length === 0 && !aiLoading) {
      generatePredictions(coins);
    }
  }, [coins]);

  const handleApprove = useCallback(async (signal: any) => {
    try {
      if (settings.mode === "paper") {
        const entryPrice = parseFloat(signal.entryPrice?.replace(/[^0-9.]/g, "") || signal.estimatedValueUsd?.replace(/[^0-9.]/g, "") || "0") / parseFloat(signal.quantity || "1");
        openTrade(signal, entryPrice || 0, true);
        updateSignalStatus(signal.id, "executed", { paper: true, timestamp: new Date().toISOString() });
        toast.success(`📝 Paper trade opened: ${signal.side} ${signal.quantity} ${signal.symbol}`);
      } else {
        const result = await executeOrder({
          symbol: signal.symbol,
          side: signal.side,
          type: signal.type,
          quantity: signal.quantity,
          price: signal.limitPrice,
          maxTradeUsd: settings.maxTradeUsd,
        });
        const entryPrice = parseFloat(result?.fills?.[0]?.price || signal.entryPrice?.replace(/[^0-9.]/g, "") || "0");
        openTrade(signal, entryPrice, false);
        updateSignalStatus(signal.id, "executed", result);
        toast.success(`✅ Trade executed: ${signal.side} ${signal.quantity} ${signal.symbol}`);
      }
    } catch (err) {
      updateSignalStatus(signal.id, "failed", { error: err instanceof Error ? err.message : "Unknown error" });
      toast.error(`❌ Trade failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [settings, executeOrder, updateSignalStatus, openTrade]);

  const handleReject = useCallback((id: string) => {
    updateSignalStatus(id, "rejected");
    toast.info("Trade signal skipped");
  }, [updateSignalStatus]);

  // Autonomous bot loop
  useEffect(() => {
    if (!botActive) {
      if (botIntervalRef.current) { clearInterval(botIntervalRef.current); botIntervalRef.current = null; }
      return;
    }

    const runCycle = () => {
      const pending = signalsRef.current.filter(s => s.status === "pending");
      if (pending.length > 0) {
        for (const signal of pending) {
          if (signal.confidence >= 60) {
            handleApprove(signal);
          } else {
            handleReject(signal.id);
          }
        }
      }
      if (pending.length === 0 && !signalsLoadingRef.current && coins.length > 0) {
        generateSignals(coins, balances);
      }
    };

    runCycle();
    botIntervalRef.current = setInterval(runCycle, 60000);
    return () => { if (botIntervalRef.current) clearInterval(botIntervalRef.current); };
  }, [botActive, coins, balances, generateSignals, handleApprove, handleReject]);
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
            activeTrades={activeTrades}
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
            onCloseTrade={(tradeId) => {
              const trade = activeTrades.find(t => t.id === tradeId);
              if (trade && !trade.paper && settings.mode === "live") {
                const closeSide = trade.side === "BUY" ? "SELL" : "BUY";
                executeOrder({ symbol: trade.symbol, side: closeSide, type: "MARKET", quantity: trade.quantity, maxTradeUsd: settings.maxTradeUsd * 2 })
                  .then(() => { closeTrade(tradeId); toast.success(`Closed ${trade.symbol} position`); })
                  .catch((err) => toast.error(`Failed to close: ${err.message}`));
              } else {
                closeTrade(tradeId);
                toast.success(`Closed ${trade?.symbol || ""} paper position`);
              }
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
