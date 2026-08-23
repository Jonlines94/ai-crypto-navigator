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

// Full MACD histogram series (12/26/9) — sign = momentum direction, slope = momentum strength
function macdHistogramSeries(closes: number[]): number[] {
  if (closes.length < 2) return [0];
  const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10;
  let e12 = closes[0], e26 = closes[0], signal = 0;
  const out: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    const macd = e12 - e26;
    signal = i === 1 ? macd : macd * k9 + signal * (1 - k9);
    out.push(macd - signal);
  }
  return out;
}

function computeATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) return 0;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    sum += Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }
  return sum / period;
}

function bollingerPctB(closes: number[], period = 20): number {
  if (closes.length < period) return 0.5;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / period);
  if (sd === 0) return 0.5;
  const last = closes[closes.length - 1];
  return (last - (mean - 2 * sd)) / (4 * sd);
}

interface KlineData {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

async function fetchKlines(symbol: string): Promise<KlineData | null> {
  for (const host of KLINE_HOSTS) {
    try {
      const resp = await fetch(`${host}/api/v3/klines?symbol=${symbol}&interval=1h&limit=120`);
      if (!resp.ok) { if (resp.status === 451) continue; return null; }
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 30) {
        return {
          closes: data.map((k: any) => parseFloat(k[4])),
          highs: data.map((k: any) => parseFloat(k[2])),
          lows: data.map((k: any) => parseFloat(k[3])),
          volumes: data.map((k: any) => parseFloat(k[5])),
        };
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
  trend4h: "BULLISH" | "BEARISH" | "NEUTRAL";
  emaFast: number;
  emaSlow: number;
  change1h: number;
  change6h: number;
  macdHist: number;
  macdRising: boolean;
  bbPct: number;
  atrPct: number;
  volRatio: number;
}

function summarize(symbol: string, kd: KlineData): TechSummary {
  const { closes, highs, lows, volumes } = kd;
  const rsi = computeRSI(closes);
  const emaFast = computeEMA(closes.slice(-30), 9);
  const emaSlow = computeEMA(closes.slice(-30), 21);
  const last = closes[closes.length - 1];

  const closes4h = closes.filter((_, i) => i % 4 === 3);
  const e4f = closes4h.length >= 22 ? computeEMA(closes4h, 9) : computeEMA(closes, 9);
  const e4s = closes4h.length >= 22 ? computeEMA(closes4h, 21) : computeEMA(closes, 21);

  const hist = macdHistogramSeries(closes);
  const macdHist = hist[hist.length - 1];
  const macdPrev = hist[Math.max(0, hist.length - 4)];

  const recentVol = volumes.slice(-6).reduce((a, b) => a + b, 0) / 6;
  const priorVol = volumes.slice(0, -6).reduce((a, b) => a + b, 0) / Math.max(volumes.length - 6, 1);

  const change1h = ((last - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
  const change6h = closes.length > 7 ? ((last - closes[closes.length - 7]) / closes[closes.length - 7]) * 100 : 0;

  const trendOf = (f: number, s: number): TechSummary["trend"] =>
    f > s * 1.001 ? "BULLISH" : f < s * 0.999 ? "BEARISH" : "NEUTRAL";

  return {
    symbol,
    rsi,
    trend: trendOf(emaFast, emaSlow),
    trend4h: trendOf(e4f, e4s),
    emaFast: Math.round(emaFast * 1e8) / 1e8,
    emaSlow: Math.round(emaSlow * 1e8) / 1e8,
    change1h: Math.round(change1h * 100) / 100,
    change6h: Math.round(change6h * 100) / 100,
    macdHist,
    macdRising: macdHist > macdPrev,
    bbPct: Math.round(bollingerPctB(closes) * 100) / 100,
    atrPct: last > 0 ? Math.round((computeATR(highs, lows, closes) / last) * 10000) / 100 : 0,
    volRatio: priorVol > 0 ? Math.round((recentVol / priorVol) * 100) / 100 : 1,
  };
}

async function buildTechnicalSummaries(symbols: string[]): Promise<Map<string, TechSummary>> {
  const out = new Map<string, TechSummary>();
  const results = await Promise.allSettled(symbols.map(async (sym) => {
    const kd = await fetchKlines(sym);
    if (!kd) return null;
    return summarize(sym, kd);
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
        if (te.trend4h === "BULLISH") score += 2; // multi-timeframe alignment
        if (te.macdHist > 0) score += 1;
        if (te.macdRising) score += 1;
        if (te.rsi > 40 && te.rsi < 65) score += 2; // room to run, not overbought
        if (te.rsi < 30) score += 3; // oversold bounce
        if (te.bbPct < 0.2 && te.trend === "BULLISH") score += 2; // pullback to lower band in uptrend
        if (te.volRatio >= 1.3) score += 1; // volume expansion
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
      confidence: Math.min(50 + Math.round(te ? te.score * 3 : 0), 72),
      reasoning: `Heuristic fallback: 24h ${t.change}%, RSI(1h) ${te?.rsi ?? "?"}, trend ${te?.trend ?? "?"}/${te?.trend4h ?? "?"}, MACD ${te ? (te.macdHist > 0 ? "POS" : "NEG") : "?"}, vol $${parseFloat(t.volume).toLocaleString()}`,
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

    // Fetch hourly candle data + compute indicators for the most interesting candidates.
    // BTCUSDT is always included — it defines the market regime every alt trades against.
    const klineCandidates = [
      "BTCUSDT",
      ...scanList
        .filter((t: any) => parseFloat(t.volume) > 1_000_000 && t.symbol !== "BTCUSDT")
        .slice(0, 14)
        .map((t: any) => t.symbol),
    ];
    const tech = await buildTechnicalSummaries(klineCandidates);

    const btc = tech.get("BTCUSDT");
    const regimeLine = btc
      ? `MARKET REGIME (BTC): 1h trend ${btc.trend}, 4h trend ${btc.trend4h}, RSI ${btc.rsi}, MACD hist ${btc.macdHist > 0 ? "POSITIVE" : "NEGATIVE"} (${btc.macdRising ? "rising" : "fading"}), 6h ${btc.change6h >= 0 ? "+" : ""}${btc.change6h}%. When BTC is bearish, altcoin longs need stronger confirmation; when BTC is bullish with rising MACD, favor longs.`
      : "";

    const techSummary = tech.size > 0
      ? `\n\nTECHNICAL INDICATORS (1h candles — RSI14, EMA9/21 trend on 1h AND 4h, MACD histogram, Bollinger %B, ATR volatility, volume ratio):\n` +
        [...tech.values()].map((t) =>
          `${t.symbol}: RSI ${t.rsi}, trend ${t.trend}/${t.trend4h}(4h), MACD ${t.macdHist > 0 ? "POS" : "NEG"}(${t.macdRising ? "rising" : "fading"}), %B ${t.bbPct}, ATR ${t.atrPct}%/h, vol ${t.volRatio}x, 1h ${t.change1h >= 0 ? "+" : ""}${t.change1h}%, 6h ${t.change6h >= 0 ? "+" : ""}${t.change6h}%`
        ).join("\n") +
        `\nINTERPRETATION: RSI <30 = oversold (bounce candidate), RSI >70 = overbought (avoid chasing). MACD POS+rising = strengthening momentum. %B <0.2 in an uptrend = pullback entry; %B >0.9 with fading MACD = do not chase. ATR%/h tells you realistic move size — a ${takeProfitPct}% target needs roughly ${(takeProfitPct / 2).toFixed(1)}x the hourly ATR to be reachable within a day.`
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

    const systemPrompt = `You are an elite crypto trading AI designed to MAXIMIZE PROFIT while protecting capital. You scan the ENTIRE Binance market — hundreds of USDT pairs — with a full technical indicator suite.

${regimeLine}

ANALYSIS FRAMEWORK (use ALL of it):
1. MULTI-INDICATOR CONFLUENCE IS MANDATORY: Every trade MUST have at least 3 of these 5 agreeing with the trade direction: 1h trend (EMA9/21), 4h trend, MACD histogram (sign AND slope), RSI(14), volume ratio. A trade without confluence is gambling — skip it.
2. MULTI-TIMEFRAME ALIGNMENT: The best longs have 1h AND 4h trends both BULLISH. A long against a bearish 4h trend is only valid as an oversold reversal (RSI < 30 AND MACD histogram rising) — size confidence accordingly.
3. MOMENTUM QUALITY: MACD histogram positive AND rising = accelerating move (best entries). Positive but fading = late, avoid chasing. Negative but rising in an oversold RSI = early reversal signal.
4. VOLUME CONFIRMATION: Only trade pairs with sufficient volume (>$1M 24h). Volume ratio >= 1.3x average confirms the move is real; breakouts on falling volume fail.
5. BOLLINGER CONTEXT: %B < 0.2 in an uptrend = pullback entry (best risk/reward). %B > 0.9 with fading MACD = exhausted, do not buy.
6. VOLATILITY FEASIBILITY: Check the user's take-profit (${takeProfitPct}%) against the pair's hourly ATR. If the target needs an unrealistic move for the timeframe, LOWER the confidence — do not change the user's SL/TP percentages.
7. RELATIVE STRENGTH: Compare ALL pairs. Long the strongest performers with fresh momentum, avoid laggards and anything already up >15% in 24h.
8. REGIME FILTER: If BTC's regime is bearish (bearish 4h + negative MACD), require 4/5 confluence for altcoin longs and cap confidence at 75.

TRADE SELECTION:
- Search BEYOND top-10 majors. Mid-caps often have the best risk/reward.
- Mix: 1-2 high-conviction majors + 1-2 high-potential altcoins.
- NEVER recommend a trade on a symbol that already has an open position.
- Quality over quantity: if nothing meets the confluence bar, recommend fewer trades — even zero.

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
- Confidence must reflect confluence: 80+ only when both timeframes + MACD + RSI + volume ALL agree
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
          { role: "user", content: `Analyze ALL data below and recommend the most profitable trades with multi-indicator confluence:\n\n${marketSummary}${techSummary}${tickerSummary}${portfolioSummary}${activeTradesSummary}` },
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
                      reasoning: { type: "string", description: "Reasoning citing RSI, MACD, trend alignment, volume and momentum evidence" },
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
