import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KLINE_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
];

// ---------- Technical indicator math ----------
function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

function computeEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

async function fetchKlines(symbol: string): Promise<number[] | null> {
  for (const host of KLINE_HOSTS) {
    try {
      const resp = await fetch(`${host}/api/v3/klines?symbol=${symbol}&interval=1h&limit=50`);
      if (!resp.ok) { if (resp.status === 451) continue; return null; }
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 20) {
        return data.map((k: any) => parseFloat(k[4])); // close prices
      }
      return null;
    } catch { continue; }
  }
  return null;
}

interface TechSummary {
  symbol: string;
  rsi: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  emaFast: number;
  emaSlow: number;
  change1h: number;
  change6h: number;
}

async function buildTechnicalSummaries(symbols: string[]): Promise<Map<string, TechSummary>> {
  const out = new Map<string, TechSummary>();
  const results = await Promise.allSettled(symbols.map(async (sym) => {
    const closes = await fetchKlines(sym);
    if (!closes) return null;
    const rsi = computeRSI(closes);
    const emaFast = computeEMA(closes.slice(-30), 9);
    const emaSlow = computeEMA(closes.slice(-30), 21);
    const last = closes[closes.length - 1];
    const change1h = ((last - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
    const change6h = closes.length > 7 ? ((last - closes[closes.length - 7]) / closes[closes.length - 7]) * 100 : 0;
    const trend: TechSummary["trend"] =
      emaFast > emaSlow * 1.001 ? "BULLISH" : emaFast < emaSlow * 0.999 ? "BEARISH" : "NEUTRAL";
    return {
      symbol: sym, rsi, trend,
      emaFast: Math.round(emaFast * 1e8) / 1e8,
      emaSlow: Math.round(emaSlow * 1e8) / 1e8,
      change1h: Math.round(change1h * 100) / 100,
      change6h: Math.round(change6h * 100) / 100,
    } as TechSummary;
  }));
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) out.set(r.value.symbol, r.value);
  }
  return out;
}

// ---------- Deterministic fallback (no AI) ----------
function fallbackSignals(allTickers: any[], tech: Map<string, TechSummary>, settings: any) {
  const maxTradeUsd = settings?.maxTradeUsd || 30;
  const stopLossPct = settings?.stopLossPct || 5;
  const takeProfitPct = settings?.takeProfitPct || 10;
  const candidates = (allTickers || [])
    .filter((t: any) => parseFloat(t.volume) > 1_000_000)
    .map((t: any) => {
      const te = tech.get(t.symbol);
      const chg = parseFloat(t.change);
      let score = 0;
      if (te) {
        if (te.trend === "BULLISH") score += 2;
        if (te.rsi > 40 && te.rsi < 65) score += 2; // room to run, not overbought
        if (te.rsi < 30) score += 3; // oversold bounce
        if (te.change6h > 0.5) score += 1;
      }
      if (chg > 1 && chg < 8) score += 2; // momentum without blowoff
      score += Math.min(parseFloat(t.volume) / 50_000_000, 2);
      return { t, te, score };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3);

  const trades = candidates.map(({ t, te }: any) => {
    const price = parseFloat(t.price);
    const qty = (maxTradeUsd / price).toPrecision(4);
    return {
      symbol: t.symbol,
      side: "BUY",
      type: "MARKET",
      quantity: qty,
      entryPrice: `$${price}`,
      stopLoss: `$${(price * (1 - stopLossPct / 100)).toPrecision(6)}`,
      takeProfit: `$${(price * (1 + takeProfitPct / 100)).toPrecision(6)}`,
      confidence: Math.min(50 + Math.round(te ? te.score * 4 : 0), 72),
      reasoning: `Heuristic fallback: 24h ${t.change}%, RSI(1h) ${te?.rsi ?? "?"}, trend ${te?.trend ?? "?"}, vol $${parseFloat(t.volume).toLocaleString()}`,
      estimatedValueUsd: `$${maxTradeUsd}`,
      riskRewardRatio: `1:${(takeProfitPct / stopLossPct).toFixed(1)}`,
    };
  });

  return {
    trades,
    marketOutlook: "AI unavailable — using momentum/RSI heuristic scan. Trade with reduced confidence.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { coins, binanceTickers, portfolio, activeTrades, settings } = await req.json();

    if (!coins || !Array.isArray(coins) || coins.length === 0) {
      return new Response(JSON.stringify({ error: "coins array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Fetch hourly candle data + compute indicators for the most interesting candidates
    const klineCandidates = scanList
      .filter((t: any) => parseFloat(t.volume) > 1_000_000)
      .slice(0, 14)
      .map((t: any) => t.symbol);
    const tech = await buildTechnicalSummaries(klineCandidates);

    const techSummary = tech.size > 0
      ? `\n\nTECHNICAL INDICATORS (1h candles — RSI14, EMA9/21 trend, momentum):\n` +
        [...tech.values()].map((t) =>
          `${t.symbol}: RSI ${t.rsi}, trend ${t.trend}, 1h ${t.change1h >= 0 ? "+" : ""}${t.change1h}%, 6h ${t.change6h >= 0 ? "+" : ""}${t.change6h}%`
        ).join("\n") +
        `\nINTERPRETATION: RSI <30 = oversold (bounce candidate), RSI >70 = overbought (avoid chasing), BULLISH trend = EMA9 above EMA21.`
      : "";

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
        ).join("\n")}\nDo NOT recommend new trades on symbols that already have an open position. Consider whether any open trades should be closed.`
      : "";

    const systemPrompt = `You are an elite crypto trading AI designed to MAXIMIZE PROFIT while protecting capital. You scan the ENTIRE Binance market — hundreds of USDT pairs — with real technical indicator data.

ANALYSIS FRAMEWORK (use ALL of it):
1. TECHNICAL CONFIRMATION IS MANDATORY: Every trade MUST be supported by the technical indicator data. Prefer trades where: trend (EMA9/21) agrees with trade direction, RSI confirms entry (BUY when RSI 30-65 with BULLISH trend; avoid BUY when RSI >70 unless breakout volume is extreme; SELL/avoid when trend is BEARISH and RSI falling).
2. VOLUME CONFIRMATION: Only trade pairs with sufficient volume (>$1M 24h). Volume anomalies (sudden spikes) precede big moves — prioritize them.
3. MOMENTUM PLAYS: 1h and 6h momentum positive but not exhausted (1-8% 24h gains with BULLISH trend = continuation; >15% = likely too late).
4. TREND REVERSAL: Big losers with RSI <30 near 24h low = bounce candidates, ONLY if 1h momentum is turning positive.
5. RELATIVE STRENGTH: Compare ALL pairs. Long the strongest, avoid the weakest.
6. RANGE POSITION: Price near 24h low with bullish indicators = good entry. Near 24h high with RSI >70 = avoid or sell.

TRADE SELECTION:
- Search BEYOND top-10 majors. Mid-caps often have the best risk/reward.
- Mix: 1-2 high-conviction majors + 1-2 high-potential altcoins.
- NEVER recommend a trade on a symbol that already has an open position.
- Quality over quantity: if nothing meets criteria, recommend fewer trades. A trade without technical confirmation is gambling.

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
- Use Binance USDT trading pairs (e.g., BTCUSDT, ETHUSDT, SOLUSDT)
- Quantity must be realistic for the pair's minimum lot size and price
- Each trade's estimatedValueUsd must be within $${maxTradeUsd} and within remaining budget
- Recommend 2-5 HIGH CONVICTION trades from ANY pair in the data
- Include the exact entry price for each trade
- Confidence must reflect technical alignment: 80+ only when trend + RSI + volume + momentum ALL agree
- For SELL signals on pairs you don't hold, these represent SHORT sentiment — note to sell if held

Respond ONLY by calling the provided tool.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.warn("No AI key — using heuristic fallback");
      const fallback = fallbackSignals(allTickers, tech, settings);
      return new Response(JSON.stringify({ ...fallback, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          { role: "user", content: `Analyze ALL data below and recommend the most profitable trades with technical confirmation:\n\n${marketSummary}${techSummary}${tickerSummary}${portfolioSummary}${activeTradesSummary}` },
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
                      reasoning: { type: "string", description: "Reasoning citing RSI, trend, volume and momentum evidence" },
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
      if (status === 402) {
        console.warn("AI credits exhausted — using heuristic fallback");
        const fallback = fallbackSignals(allTickers, tech, settings);
        return new Response(JSON.stringify({ ...fallback, fallback: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
