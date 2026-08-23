import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BINANCE_DATA = "https://data-api.binance.vision";

const numberValue = (value: unknown) => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatUsd = (value: number) => {
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })}`;
};

// ---------- Technical indicators ----------

const ema = (values: number[], period: number): number => {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
};

const rsi = (closes: number[], period = 14): number => {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
};

interface Indicators {
  rsi1h: number;
  ema9: number;
  ema21: number;
  trend: "bullish" | "bearish";
  change1h: number;
  change4h: number;
  volumeRatio: number; // recent 6h avg volume vs prior 42h avg
}

const fetchIndicators = async (symbol: string): Promise<Indicators | null> => {
  try {
    const res = await fetch(
      `${BINANCE_DATA}/api/v3/klines?symbol=${String(symbol).toUpperCase()}USDT&interval=1h&limit=50`
    );
    if (!res.ok) return null;
    const klines = await res.json();
    if (!Array.isArray(klines) || klines.length < 30) return null;

    const closes = klines.map((k: any[]) => numberValue(k[4]));
    const volumes = klines.map((k: any[]) => numberValue(k[5]));
    const last = closes[closes.length - 1];

    const ema9 = ema(closes.slice(-30), 9);
    const ema21 = ema(closes.slice(-30), 21);

    const recentVol = volumes.slice(-6).reduce((a, b) => a + b, 0) / 6;
    const priorVol = volumes.slice(0, -6).reduce((a, b) => a + b, 0) / Math.max(volumes.length - 6, 1);

    return {
      rsi1h: Math.round(rsi(closes) * 10) / 10,
      ema9,
      ema21,
      trend: ema9 >= ema21 ? "bullish" : "bearish",
      change1h: closes.length > 1 ? ((last - closes[closes.length - 2]) / closes[closes.length - 2]) * 100 : 0,
      change4h: closes.length > 4 ? ((last - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0,
      volumeRatio: priorVol > 0 ? recentVol / priorVol : 1,
    };
  } catch {
    return null;
  }
};

// ---------- Deterministic fallback (uses indicators when available) ----------

const buildFallbackPredictions = (coins: any[], indicators: Record<string, Indicators | null>) => {
  const predictions = coins.map((coin: any) => {
    const price = numberValue(coin.price);
    const change24h = numberValue(coin.change24h);
    const high24h = numberValue(coin.high24h);
    const low24h = numberValue(coin.low24h);
    const volume = numberValue(coin.volume);
    const marketCap = numberValue(coin.marketCap);
    const ind = indicators[String(coin.symbol).toUpperCase()];

    const range = high24h > low24h ? high24h - low24h : Math.max(price * 0.06, 0.000001);
    const positionInRange = range > 0 ? (price - low24h) / range : 0.5;
    const volumeStrength = marketCap > 0 ? Math.min(volume / marketCap, 0.25) / 0.25 : 0;

    let action: "BUY" | "SELL" | "HOLD" = "HOLD";
    let target = price;
    let stopLoss = price * 0.97;
    let confidence = 60;
    let verdict = "No clear edge — stay flat";
    let reasoning = "Indicators are mixed, so the highest-probability move is to wait for a confirmed break of the range.";

    const bullTrend = ind ? ind.trend === "bullish" : change24h > 0;
    const oversold = ind ? ind.rsi1h <= 35 : positionInRange <= 0.2;
    const overbought = ind ? ind.rsi1h >= 68 : positionInRange >= 0.85;
    const volConfirm = ind ? ind.volumeRatio >= 1.2 : volumeStrength > 0.4;

    if (bullTrend && oversold) {
      action = "BUY";
      target = price * 1.05;
      stopLoss = price * 0.975;
      confidence = 78;
      verdict = "Buy the dip in uptrend";
      reasoning = `Uptrend intact (EMA9 above EMA21) with RSI at ${ind?.rsi1h ?? "oversold levels"} — pullback entry with a target ${formatUsd(target)} and invalidation below ${formatUsd(stopLoss)}.`;
    } else if (bullTrend && change24h >= 3 && volConfirm) {
      action = "BUY";
      target = price * 1.06;
      stopLoss = price * 0.97;
      confidence = 74;
      verdict = "Momentum continuation long";
      reasoning = `Price is up ${change24h.toFixed(1)}% on rising volume with the 1h trend bullish — continuation toward ${formatUsd(target)} is the higher-probability path.`;
    } else if (!bullTrend && overbought) {
      action = "SELL";
      target = price * 0.95;
      stopLoss = price * 1.025;
      confidence = 76;
      verdict = "Fade the rally";
      reasoning = `Bearish trend with RSI stretched at ${ind?.rsi1h ?? "overbought levels"} — rallies are for selling, targeting ${formatUsd(target)} with invalidation above ${formatUsd(stopLoss)}.`;
    } else if (!bullTrend && change24h <= -3 && volConfirm) {
      action = "SELL";
      target = price * 0.94;
      stopLoss = price * 1.02;
      confidence = 72;
      verdict = "Breakdown — exit longs";
      reasoning = `Down ${Math.abs(change24h).toFixed(1)}% on elevated volume in a bearish 1h trend — further downside toward ${formatUsd(target)} is likely before any base forms.`;
    } else {
      target = price * (bullTrend ? 1.02 : 0.98);
      stopLoss = price * (bullTrend ? 0.985 : 1.015);
      confidence = 58;
    }

    return {
      asset: coin.name,
      symbol: String(coin.symbol || "").toUpperCase(),
      action,
      confidence,
      target: formatUsd(target),
      current: formatUsd(price),
      entry: formatUsd(price),
      stopLoss: formatUsd(stopLoss),
      timeframe: "24-72h swing",
      verdict,
      reasoning,
    };
  });

  return {
    predictions,
    fallback: true,
    message: "AI credits are unavailable, so predictions are using indicator-based fallback logic.",
  };
};

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { coins } = await req.json();
    if (!coins || !Array.isArray(coins) || coins.length === 0) {
      return new Response(JSON.stringify({ error: "coins array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Pull real 1h technicals for every coin in parallel
    const indicatorResults = await Promise.all(
      coins.map((c: any) => fetchIndicators(c.symbol))
    );
    const indicators: Record<string, Indicators | null> = {};
    coins.forEach((c: any, i: number) => {
      indicators[String(c.symbol).toUpperCase()] = indicatorResults[i];
    });

    const marketSummary = coins
      .map((c: any) => {
        const ind = indicators[String(c.symbol).toUpperCase()];
        const base = `${c.name} (${String(c.symbol).toUpperCase()}): Price $${c.price}, 24h change ${c.change24h}%, Market Cap $${c.marketCap}, 24h Volume $${c.volume}, 24h High $${c.high24h}, 24h Low $${c.low24h}`;
        if (!ind) return base;
        return `${base} | 1h RSI(14): ${ind.rsi1h}, 1h trend: ${ind.trend.toUpperCase()} (EMA9 ${ind.ema9 >= ind.ema21 ? ">" : "<"} EMA21), 1h change ${ind.change1h.toFixed(2)}%, 4h change ${ind.change4h.toFixed(2)}%, volume ${ind.volumeRatio >= 1.2 ? "RISING" : ind.volumeRatio <= 0.8 ? "FALLING" : "FLAT"} (${ind.volumeRatio.toFixed(2)}x avg)`;
      })
      .join("\n");

    const systemPrompt = `You are an elite crypto trading strategist. You give DECISIVE, committed calls — never wishy-washy analysis. You must respond ONLY by calling the provided tool.

Hard rules for every asset:
1. COMMIT to exactly one action: BUY, SELL, or HOLD. No hedging language ("might", "could", "possibly", "may") anywhere in your output.
2. Only issue BUY or SELL when confidence is 65+ AND at least two of these agree: 1h trend (EMA9 vs EMA21), RSI(14), 24h momentum, volume trend. If they conflict, output HOLD and state exactly what would trigger a trade.
3. Every call needs concrete levels: entry (current price area), target (realistic 2-8% move), stopLoss (invalidation), timeframe (e.g. "24-72h swing", "intraday", "1-2 weeks").
4. reasoning: exactly 1-2 sentences citing the actual numbers (RSI value, EMA alignment, 24h change, volume ratio) and stating what WILL happen — not what might.
5. verdict: a punchy 3-6 word call, e.g. "Breakout continuation — buy strength", "Distribution — exit rallies now", "Dead range — wait for break".
6. Confidence 50-95. Reserve 80+ for setups where trend, momentum and volume all align.`;

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
          {
            role: "user",
            content: `Here is live market data with 1h technical indicators for each asset. Give your committed trading call for every one:\n\n${marketSummary}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_predictions",
              description: "Return committed trading calls for the analyzed cryptocurrencies.",
              parameters: {
                type: "object",
                properties: {
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        asset: { type: "string", description: "Coin name" },
                        symbol: { type: "string", description: "Ticker symbol uppercase" },
                        action: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
                        confidence: { type: "number", description: "Confidence 50-95" },
                        current: { type: "string", description: "Current price with $ sign" },
                        entry: { type: "string", description: "Entry price zone with $ sign" },
                        target: { type: "string", description: "Target price with $ sign" },
                        stopLoss: { type: "string", description: "Stop loss / invalidation price with $ sign" },
                        timeframe: { type: "string", description: "Expected hold period, e.g. 24-72h swing" },
                        verdict: { type: "string", description: "Punchy 3-6 word call" },
                        reasoning: { type: "string", description: "1-2 decisive sentences citing the numbers" },
                      },
                      required: ["asset", "symbol", "action", "confidence", "current", "entry", "target", "stopLoss", "timeframe", "verdict", "reasoning"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["predictions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_predictions" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify(buildFallbackPredictions(coins, indicators)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const predictions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(predictions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("crypto-predictions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
