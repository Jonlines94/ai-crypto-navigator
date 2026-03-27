import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { coins, binanceTickers, portfolio, activeTrades, settings } = await req.json();

    if (!coins || !Array.isArray(coins) || coins.length === 0) {
      return new Response(JSON.stringify({ error: "coins array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const maxTradeUsd = settings?.maxTradeUsd || 100;
    const riskLevel = settings?.riskLevel || "medium";
    const stopLossPct = settings?.stopLossPct || 5;
    const takeProfitPct = settings?.takeProfitPct || 10;
    const totalBalanceUsd = settings?.totalBalanceUsd || 0;

    const marketSummary = coins.map((c: any) =>
      `${c.name} (${c.symbol}): Price $${c.price}, 24h change ${c.change24h}%, Volume $${c.volume}, High $${c.high24h}, Low $${c.low24h}, Market Cap $${c.marketCap}`
    ).join("\n");

    // Categorize tickers for comprehensive scanning
    const allTickers = binanceTickers || [];
    const topByVolume = allTickers.slice(0, 50);
    const bigMovers = allTickers
      .filter((t: any) => Math.abs(parseFloat(t.change)) > 3)
      .sort((a: any, b: any) => Math.abs(parseFloat(b.change)) - Math.abs(parseFloat(a.change)))
      .slice(0, 30);
    const gainers = allTickers
      .filter((t: any) => parseFloat(t.change) > 2)
      .sort((a: any, b: any) => parseFloat(b.change) - parseFloat(a.change))
      .slice(0, 20);
    const losers = allTickers
      .filter((t: any) => parseFloat(t.change) < -2)
      .sort((a: any, b: any) => parseFloat(a.change) - parseFloat(b.change))
      .slice(0, 20);

    // Merge unique tickers
    const seen = new Set<string>();
    const scanList: any[] = [];
    for (const t of [...topByVolume, ...bigMovers, ...gainers, ...losers]) {
      if (!seen.has(t.symbol)) { seen.add(t.symbol); scanList.push(t); }
    }

    const tickerSummary = scanList.length > 0
      ? `\n\nFULL BINANCE SCAN (${allTickers.length} total USDT pairs, showing ${scanList.length} most interesting):\n` +
        `\n--- TOP BY VOLUME (${topByVolume.length}) ---\n${topByVolume.map((t: any) =>
          `${t.symbol}: $${t.price}, 24h ${t.change}%, Vol $${parseFloat(t.volume).toLocaleString()}, H $${t.high}, L $${t.low}, Trades ${t.trades}`
        ).join("\n")}` +
        (gainers.length > 0 ? `\n\n--- TOP GAINERS ---\n${gainers.map((t: any) =>
          `${t.symbol}: $${t.price}, +${t.change}%, Vol $${parseFloat(t.volume).toLocaleString()}`
        ).join("\n")}` : "") +
        (losers.length > 0 ? `\n\n--- TOP LOSERS (reversal opportunities) ---\n${losers.map((t: any) =>
          `${t.symbol}: $${t.price}, ${t.change}%, Vol $${parseFloat(t.volume).toLocaleString()}`
        ).join("\n")}` : "")
      : "";

    const portfolioSummary = portfolio?.length > 0
      ? `\n\nCurrent portfolio:\n${portfolio.map((p: any) => `${p.asset}: ${p.free} available (${p.locked} locked)`).join("\n")}`
      : "\n\nNo current holdings provided.";

    const activeTradesSummary = activeTrades?.length > 0
      ? `\n\nCurrently open trades:\n${activeTrades.map((t: any) =>
          `${t.side} ${t.quantity} ${t.symbol} @ $${t.entryPrice} (now $${t.currentPrice}, P&L: $${t.pnl} / ${t.pnlPercent}%, SL $${t.stopLoss}, TP $${t.takeProfit})`
        ).join("\n")}\nConsider whether any open trades should be closed or adjusted.`
      : "";

    const systemPrompt = `You are an elite crypto trading AI designed to MAXIMIZE PROFIT. You have access to the ENTIRE Binance market — hundreds of USDT trading pairs. Your job is to scan ALL available data and find the BEST trades across the ENTIRE market, not just major coins.

SCANNING STRATEGY:
1. SCAN ALL PAIRS: Look through every ticker provided — top volume, gainers, losers, and big movers. The best trades are often in mid-cap or smaller pairs with strong momentum.
2. VOLUME CONFIRMATION: Only trade pairs with sufficient volume (>$1M 24h) to ensure liquidity.
3. TREND REVERSAL: Look for oversold pairs (big losers near support) for bounce trades.
4. MOMENTUM PLAYS: Look for pairs starting breakouts — moderate gains with increasing volume.
5. RELATIVE STRENGTH: Compare across ALL pairs. Find the strongest outperformers and weakest underperformers.
6. RANGE ANALYSIS: Wide high-low spread = volatility opportunity. Price near low = potential buy. Near high with fading volume = potential sell.
7. VOLUME ANOMALIES: Unusual volume spikes often precede big moves — prioritize these.

TRADE SELECTION:
- Search BEYOND the top 10 major coins. Mid-cap altcoins often have the best risk/reward.
- Mix trade types: 1-2 high-conviction major pair trades + 1-2 high-potential altcoin trades.
- Consider pairs you may not typically trade — the AI advantage is scanning everything.

CRITICAL BUDGET CONSTRAINT:
- Total account balance: $${totalBalanceUsd > 0 ? totalBalanceUsd.toFixed(2) : "unknown"}
- NEVER recommend trades that would exceed the total account balance
- Max trade size: $${maxTradeUsd} per trade (hard limit)
- The TOTAL value of ALL recommended trades combined must NOT exceed the available balance
- If balance is low, recommend fewer trades or smaller positions

RULES:
- Risk level: ${riskLevel} (conservative=small positions+tight stops, medium=balanced, aggressive=larger positions+wider stops)
- Stop-loss: EXACTLY ${stopLossPct}% from entry price
- Take-profit: EXACTLY ${takeProfitPct}% from entry price
- These SL/TP percentages are USER-CONFIGURED — always use them precisely
- Use Binance USDT trading pairs (e.g., BTCUSDT, ETHUSDT, SOLUSDT, CFGUSDT, etc.)
- Quantity must be realistic for the pair's minimum lot size and price
- Each trade's estimatedValueUsd must be within $${maxTradeUsd} and within remaining budget
- Recommend 2-5 HIGH CONVICTION trades from ANY pair in the data
- Include the exact entry price for each trade
- For SELL signals on pairs you don't hold, these represent SHORT sentiment — note to sell if held

Respond ONLY by calling the provided tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze ALL data below and recommend the most profitable trades:\n\n${marketSummary}${tickerSummary}${portfolioSummary}${activeTradesSummary}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_trades",
            description: "Return specific actionable trade recommendations with exact prices",
            parameters: {
              type: "object",
              properties: {
                trades: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string", description: "Binance pair e.g. BTCUSDT" },
                      side: { type: "string", enum: ["BUY", "SELL"] },
                      type: { type: "string", enum: ["MARKET", "LIMIT"] },
                      quantity: { type: "string", description: "Amount to trade" },
                      entryPrice: { type: "string", description: "Expected entry price in USD" },
                      limitPrice: { type: "string", description: "Limit price if LIMIT order" },
                      stopLoss: { type: "string", description: "Stop-loss price with $ sign" },
                      takeProfit: { type: "string", description: "Take-profit price with $ sign" },
                      confidence: { type: "number", description: "Confidence 50-98" },
                      reasoning: { type: "string", description: "Detailed reasoning including which analysis methods support this trade" },
                      estimatedValueUsd: { type: "string", description: "Estimated USD value of trade" },
                      riskRewardRatio: { type: "string", description: "Risk/reward ratio e.g. 1:2.5" },
                    },
                    required: ["symbol", "side", "type", "quantity", "entryPrice", "stopLoss", "takeProfit", "confidence", "reasoning", "estimatedValueUsd", "riskRewardRatio"],
                    additionalProperties: false,
                  },
                },
                marketOutlook: { type: "string", description: "2-3 sentence market outlook with key levels and sentiment" },
                closeRecommendations: {
                  type: "array",
                  description: "IDs of active trades that should be closed",
                  items: { type: "string" },
                },
              },
              required: ["trades", "marketOutlook"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_trades" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      throw new Error(`AI gateway error: ${status} - ${t}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trade-signals error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
