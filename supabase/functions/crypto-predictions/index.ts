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

// Full MACD histogram series (12/26/9) so we can tell if momentum is rising or fading
const macdHistogramSeries = (closes: number[]): number[] => {
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
};

const atr = (highs: number[], lows: number[], closes: number[], period = 14): number => {
  if (closes.length < period + 1) return 0;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    sum += tr;
  }
  return sum / period;
};

const bollingerPctB = (closes: number[], period = 20): number => {
  if (closes.length < period) return 0.5;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / period;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0.5;
  const upper = mean + 2 * sd;
  const lower = mean - 2 * sd;
  const last = closes[closes.length - 1];
  return (last - lower) / (upper - lower);
};

interface Indicators {
  rsi1h: number;
  ema9: number;
  ema21: number;
  trend: "bullish" | "bearish";
  trend4h: "bullish" | "bearish";
  change1h: number;
  change4h: number;
  volumeRatio: number; // recent 6h avg volume vs prior avg
  macdHist: number; // + = bullish momentum, - = bearish
  macdRising: boolean; // histogram now vs 3 bars ago
  bbPct: number; // 0 = lower band, 1 = upper band
  atrPct: number; // 1h ATR as % of price (volatility)
}

const fetchIndicators = async (symbol: string): Promise<Indicators | null> => {
  try {
    const res = await fetch(
      `${BINANCE_DATA}/api/v3/klines?symbol=${String(symbol).toUpperCase()}USDT&interval=1h&limit=120`
    );
    if (!res.ok) return null;
    const klines = await res.json();
    if (!Array.isArray(klines) || klines.length < 30) return null;

    const closes = klines.map((k: any[]) => numberValue(k[4]));
    const highs = klines.map((k: any[]) => numberValue(k[2]));
    const lows = klines.map((k: any[]) => numberValue(k[3]));
    const volumes = klines.map((k: any[]) => numberValue(k[5]));
    const last = closes[closes.length - 1];

    const ema9 = ema(closes.slice(-30), 9);
    const ema21 = ema(closes.slice(-30), 21);

    // Approximate 4h trend by resampling 1h closes at candle close boundaries
    const closes4h = closes.filter((_: number, i: number) => i % 4 === 3);
    const trend4h = closes4h.length >= 22
      ? (ema(closes4h, 9) >= ema(closes4h, 21) ? "bullish" : "bearish")
      : (ema(closes, 9) >= ema(closes, 21) ? "bullish" : "bearish");

    const recentVol = volumes.slice(-6).reduce((a, b) => a + b, 0) / 6;
    const priorVol = volumes.slice(0, -6).reduce((a, b) => a + b, 0) / Math.max(volumes.length - 6, 1);

    const histSeries = macdHistogramSeries(closes);
    const macdHist = histSeries[histSeries.length - 1];
    const macdPrev = histSeries[Math.max(0, histSeries.length - 4)];
    const atrVal = atr(highs, lows, closes);

    return {
      rsi1h: Math.round(rsi(closes) * 10) / 10,
      ema9,
      ema21,
      trend: ema9 >= ema21 ? "bullish" : "bearish",
      trend4h,
      change1h: closes.length > 1 ? ((last - closes[closes.length - 2]) / closes[closes.length - 2]) * 100 : 0,
      change4h: closes.length > 4 ? ((last - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0,
      volumeRatio: priorVol > 0 ? recentVol / priorVol : 1,
      macdHist,
      macdRising: macdHist > macdPrev,
      bbPct: Math.round(bollingerPctB(closes) * 100) / 100,
      atrPct: last > 0 ? (atrVal / last) * 100 : 0,
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
    const bull4h = ind ? ind.trend4h === "bullish" : bullTrend;
    const macdOk = ind ? ind.macdHist > 0 : true;
    const oversold = ind ? (ind.rsi1h <= 35 || ind.bbPct <= 0.15) : positionInRange <= 0.2;
    const overbought = ind ? (ind.rsi1h >= 68 || ind.bbPct >= 0.9) : positionInRange >= 0.85;
    const volConfirm = ind ? ind.volumeRatio >= 1.2 : volumeStrength > 0.4;

    if (bullTrend && bull4h && oversold) {
      action = "BUY";
      target = price * 1.05;
      stopLoss = price * 0.975;
      confidence = 78;
      verdict = "Buy the dip in uptrend";
      reasoning = `Uptrend intact on both 1h and 4h with RSI at ${ind?.rsi1h ?? "oversold levels"} — pullback entry with a target ${formatUsd(target)} and invalidation below ${formatUsd(stopLoss)}.`;
    } else if (bullTrend && macdOk && change24h >= 3 && volConfirm) {
      action = "BUY";
      target = price * 1.06;
      stopLoss = price * 0.97;
      confidence = 74;
      verdict = "Momentum continuation long";
      reasoning = `Price is up ${change24h.toFixed(1)}% on rising volume with bullish 1h trend and positive MACD — continuation toward ${formatUsd(target)} is the higher-probability path.`;
    } else if (!bullTrend && overbought) {
      action = "SELL";
      target = price * 0.95;
      stopLoss = price * 1.025;
      confidence = 76;
      verdict = "Fade the rally";
      reasoning = `Bearish trend with RSI stretched at ${ind?.rsi1h ?? "overbought levels"} — rallies are for selling, targeting ${formatUsd(target)} with invalidation above ${formatUsd(stopLoss)}.`;
    } else if (!bullTrend && !macdOk && change24h <= -3 && volConfirm) {
      action = "SELL";
      target = price * 0.94;
      stopLoss = price * 1.02;
      confidence = 72;
      verdict = "Breakdown — exit longs";
      reasoning = `Down ${Math.abs(change24h).toFixed(1)}% on elevated volume in a bearish 1h trend with negative MACD — further downside toward ${formatUsd(target)} is likely before any base forms.`;
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

    // Pull real 1h technicals for every coin in parallel (120 candles → 1h + derived 4h)
    const indicatorResults = await Promise.all(
      coins.map((c: any) => fetchIndicators(c.symbol))
    );
    const indicators: Record<string, Indicators | null> = {};
    coins.forEach((c: any, i: number) => {
      indicators[String(c.symbol).toUpperCase()] = indicatorResults[i];
    });

    // BTC sets the market regime — alts trade with beta to it
    const btc = indicators["BTC"];
    const regime = btc
      ? `MARKET REGIME (BTC): 1h trend ${btc.trend.toUpperCase()}, 4h trend ${btc.trend4h.toUpperCase()}, RSI ${btc.rsi1h}, MACD hist ${btc.macdHist > 0 ? "POSITIVE" : "NEGATIVE"} (${btc.macdRising ? "rising" : "fading"}), 24h change ${numberValue(coins.find((c: any) => String(c.symbol).toUpperCase() === "BTC")?.change24h).toFixed(2)}%.`
      : "";

    const marketSummary = coins
      .map((c: any) => {
        const ind = indicators[String(c.symbol).toUpperCase()];
        const base = `${c.name} (${String(c.symbol).toUpperCase()}): Price $${c.price}, 24h change ${c.change24h}%, Market Cap $${c.marketCap}, 24h Volume $${c.volume}, 24h High $${c.high24h}, 24h Low $${c.low24h}`;
        if (!ind) return base;
        return `${base} | 1h RSI(14): ${ind.rsi1h}, 1h trend: ${ind.trend.toUpperCase()}, 4h trend: ${ind.trend4h.toUpperCase()}, MACD hist: ${ind.macdHist > 0 ? "POSITIVE" : "NEGATIVE"} (${ind.macdRising ? "rising" : "fading"}), Bollinger %B: ${ind.bbPct}, 1h ATR: ${ind.atrPct.toFixed(2)}%, 1h change ${ind.change1h.toFixed(2)}%, 4h change ${ind.change4h.toFixed(2)}%, volume ${ind.volumeRatio >= 1.2 ? "RISING" : ind.volumeRatio <= 0.8 ? "FALLING" : "FLAT"} (${ind.volumeRatio.toFixed(2)}x avg)`;
      })
      .join("\n");

    const systemPrompt = `You are an elite crypto trading strategist. You give DECISIVE, committed calls — never wishy-washy analysis. You must respond ONLY by calling the provided tool.

You receive rich technicals per asset: 1h RSI(14), 1h trend (EMA9 vs EMA21), 4h trend, MACD histogram (sign + rising/fading), Bollinger %B (0=lower band, 1=upper band), 1h ATR% (volatility), and volume ratio vs average.

Hard rules for every asset:
1. COMMIT to exactly one action: BUY, SELL, or HOLD. No hedging language ("might", "could", "possibly", "may") anywhere in your output.
2. Only issue BUY or SELL when confidence is 65+ AND at least THREE of these agree: 1h trend, 4h trend, MACD histogram direction, RSI(14), volume trend. If they conflict, output HOLD and state exactly what would trigger a trade.
3. MULTI-TIMEFRAME ALIGNMENT: the highest-conviction longs have BOTH 1h and 4h trends bullish with a positive, rising MACD. A BUY against a bearish 4h trend needs RSI < 30 AND a rising MACD histogram (oversold reversal) — otherwise HOLD.
4. MARKET REGIME: BTC leads the market. If BTC's 1h/4h trend is bearish with negative MACD, downgrade altcoin BUYs one confidence tier unless the alt is showing clear relative strength (green 24h while BTC is red, rising volume).
5. VOLATILITY-AWARE LEVELS: size targets to the ATR. For a 24-72h swing, a realistic target is roughly 10-30x the 1h ATR% move away; never set a target beyond ~6% for a low-ATR major or inside ~1% for a high-ATR alt. Stop loss sits at least 3x the 1h ATR% from entry so normal noise doesn't trigger it.
6. BOLLINGER CONTEXT: %B above 0.9 with fading MACD = do not chase (HOLD or SELL). %B below 0.1 in an uptrend = pullback entry zone.
7. reasoning: exactly 1-2 sentences citing the actual numbers (RSI value, MACD direction, trend alignment, volume ratio) and stating what WILL happen — not what might.
8. verdict: a punchy 3-6 word call, e.g. "Breakout continuation — buy strength", "Distribution — exit rallies now", "Dead range — wait for break".
9. Confidence 50-95. Reserve 80+ for setups where both timeframes, MACD, momentum and volume all align.`;

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
            content: `${regime ? regime + "\n\n" : ""}Here is live market data with full technical indicators for each asset. Give your committed trading call for every one:\n\n${marketSummary}`,
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
