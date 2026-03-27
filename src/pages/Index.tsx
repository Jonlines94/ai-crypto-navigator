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
    settings, tradeHistory, updateSettings, generateSignals, updateSignalStatus, openTrade, closeTrade, getMaxTradeAmount, clearAllData,
  } = useTradeSignals(handleAutoClose);

  const [activeTab, setActiveTab] = useState<"intel" | "trading">("intel");
  const [botActive, setBotActive] = useState(false);
  const botIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalsRef = useRef(signals);
  signalsRef.current = signals;
  const signalsLoadingRef = useRef(signalsLoading);
  signalsLoadingRef.current = signalsLoading;
  const accountValueRef = useRef(accountValue);
  accountValueRef.current = accountValue;
  const cycleSpentRef = useRef(0); // tracks cumulative USD spent in current bot cycle

  useEffect(() => {
    if (coins.length > 0 && predictions.length === 0 && !aiLoading) {
      generatePredictions(coins);
    }
  }, [coins]);

  const handleApprove = useCallback(async (signal: any) => {
    try {
      const tradeValue = parseFloat(signal.estimatedValueUsd?.replace(/[^0-9.]/g, "") || "0");

      // Budget check — works in BOTH paper and live modes
      const totalBalance = accountValueRef.current?.totalUsd || settings.accountBalance;
      // Only count BUY trades as consuming balance (SELL trades free up balance)
      const openBuyValue = activeTrades
        .filter(t => t.side === "BUY")
        .reduce((sum, t) => sum + parseFloat(t.quantity) * t.entryPrice, 0);
      const freeBalance = totalBalance - openBuyValue - cycleSpentRef.current;
      
      console.log(`[Bot] Trade check: ${signal.symbol} needs $${tradeValue.toFixed(2)}, balance=$${totalBalance.toFixed(2)}, openBuys=$${openBuyValue.toFixed(2)}, cycleSpent=$${cycleSpentRef.current.toFixed(2)}, free=$${freeBalance.toFixed(2)}`);
      
      if (signal.side === "BUY" && tradeValue > freeBalance) {
        toast.error(`⛔ Insufficient funds: trade needs $${tradeValue.toFixed(2)} but only $${freeBalance.toFixed(2)} available`);
        updateSignalStatus(signal.id, "rejected");
        return;
      }

      // Also enforce per-trade max
      const maxPerTrade = settings.accountBalance * (settings.maxTradePercent / 100);
      if (tradeValue > maxPerTrade) {
        toast.error(`⛔ Trade $${tradeValue.toFixed(2)} exceeds per-trade max $${maxPerTrade.toFixed(2)}`);
        updateSignalStatus(signal.id, "rejected");
        return;
      }

      // Track this trade's value for the current cycle
      cycleSpentRef.current += tradeValue;

      if (settings.mode === "paper") {
        const rawEntry = parseFloat(signal.entryPrice?.replace(/[^0-9.]/g, "") || "0");
        const entryPrice = rawEntry > 0 ? rawEntry : parseFloat(signal.estimatedValueUsd?.replace(/[^0-9.]/g, "") || "0") / parseFloat(signal.quantity || "1");
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
          maxTradeUsd: maxPerTrade,
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
  }, [settings, executeOrder, updateSignalStatus, openTrade, activeTrades]);

  const handleReject = useCallback((id: string) => {
    updateSignalStatus(id, "rejected");
    toast.info("Trade signal skipped");
  }, [updateSignalStatus]);

  // Autonomous bot loop — fully automatic, executes all trades including live
  useEffect(() => {
    if (!botActive) {
      if (botIntervalRef.current) { clearInterval(botIntervalRef.current); botIntervalRef.current = null; }
      return;
    }

    // When bot is activated, disable manual approval requirement
    if (settings.requireApproval) {
      updateSettings({ requireApproval: false });
    }

    const runCycle = async () => {
      // Reset cycle spending tracker
      cycleSpentRef.current = 0;
      // Refresh balances before each cycle to know actual available funds
      try { await fetchBalances(); } catch (e) { console.error("Balance refresh failed:", e); }

      const pending = signalsRef.current.filter(s => s.status === "pending");
      if (pending.length > 0) {
        console.log(`[Bot] Processing ${pending.length} pending signals`);
        for (const signal of pending) {
          if (signal.confidence >= 60) {
            await handleApprove(signal);
          } else {
            handleReject(signal.id);
          }
        }
      } else if (!signalsLoadingRef.current && coins.length > 0) {
        console.log("[Bot] No pending signals, generating new ones...");
        await generateSignals(coins, balances, accountValueRef.current?.totalUsd);
        // Wait a tick for state to update, then process the new signals
        await new Promise(r => setTimeout(r, 500));
        const newPending = signalsRef.current.filter(s => s.status === "pending");
        console.log(`[Bot] Generated ${newPending.length} new signals`);
        for (const signal of newPending) {
          if (signal.confidence >= 60) {
            await handleApprove(signal);
          } else {
            handleReject(signal.id);
          }
        }
      }
    };

    // Run immediately then every 60s
    toast.success(`🤖 Bot activated — ${settings.mode === "live" ? "LIVE auto-execution" : "Paper trading"} enabled`);
    runCycle();
    botIntervalRef.current = setInterval(runCycle, 60000);
    return () => { if (botIntervalRef.current) clearInterval(botIntervalRef.current); };
  }, [botActive]);
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
            onGenerateSignals={() => generateSignals(coins, balances, accountValue?.totalUsd)}
            onUpdateSettings={updateSettings}
            onApprove={handleApprove}
            onReject={handleReject}
            onFetchBalances={fetchBalances}
            onCloseTrade={(tradeId) => {
              const trade = activeTrades.find(t => t.id === tradeId);
              if (trade && !trade.paper && settings.mode === "live") {
                const closeSide = trade.side === "BUY" ? "SELL" : "BUY";
                executeOrder({ symbol: trade.symbol, side: closeSide, type: "MARKET", quantity: trade.quantity, maxTradeUsd: settings.accountBalance * 2 })
                  .then(() => { closeTrade(tradeId); toast.success(`Closed ${trade.symbol} position`); })
                  .catch((err) => toast.error(`Failed to close: ${err.message}`));
              } else {
                closeTrade(tradeId);
                toast.success(`Closed ${trade?.symbol || ""} paper position`);
              }
            }}
            botActive={botActive}
            onToggleBot={() => setBotActive(prev => !prev)}
            onClearData={() => { setBotActive(false); clearAllData(); toast.success("All trades and history cleared"); }}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
