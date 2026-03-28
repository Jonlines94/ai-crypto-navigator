import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const buildFallbackPredictions = (coins: any[]) => {
  const predictions = coins.map((coin: any) => {
    const price = numberValue(coin.price);
    const change24h = numberValue(coin.change24h);
    const high24h = numberValue(coin.high24h);
    const low24h = numberValue(coin.low24h);
    const volume = numberValue(coin.volume);
    const marketCap = numberValue(coin.marketCap);

    const range = high24h > low24h ? high24h - low24h : Math.max(price * 0.06, 0.000001);
    const positionInRange = range > 0 ? (price - low24h) / range : 0.5;
    const volumeStrength = marketCap > 0 ? Math.min(volume / marketCap, 0.25) / 0.25 : 0;

    let action: "BUY" | "SELL" | "HOLD" = "HOLD";
    let target = price;
    let confidence = 62;
    let reasoning = "Price is mid-range with balanced momentum, so the setup looks neutral for now.";

    if (change24h >= 4 && positionInRange < 0.85) {
      action = "BUY";
      target = price * (1.03 + volumeStrength * 0.05);
      confidence = Math.min(91, Math.round(68 + change24h * 2 + volumeStrength * 10));
      reasoning = "Momentum is positive and volume is supporting the move, which suggests continuation toward the upper range.";
    } else if (change24h <= -4 && positionInRange > 0.2) {
      action = "SELL";
      target = price * (0.97 - volumeStrength * 0.04);
      confidence = Math.min(90, Math.round(68 + Math.abs(change24h) * 2 + volumeStrength * 10));
      reasoning = "The asset is under pressure with strong downside momentum, so a retest lower looks more likely than an immediate rebound.";
    } else if (positionInRange <= 0.2 && change24h > -3) {
      action = "BUY";
      target = Math.min(high24h || price * 1.05, price * 1.04);
      confidence = Math.min(84, Math.round(64 + (0.2 - positionInRange) * 60 + volumeStrength * 8));
      reasoning = "Price is trading near intraday support while downside momentum is limited, creating a bounce setup.";
    } else if (positionInRange >= 0.85 && change24h < 3) {
      action = "SELL";
      target = Math.max(low24h || price * 0.96, price * 0.97);
      confidence = Math.min(84, Math.round(64 + (positionInRange - 0.85) * 80 + volumeStrength * 8));
      reasoning = "Price is stretched near the session high and the move looks vulnerable to profit-taking or resistance.";
    } else {
      target = price * (change24h >= 0 ? 1.015 : 0.985);
      confidence = Math.min(78, Math.round(60 + Math.abs(change24h) * 1.5 + volumeStrength * 6));
    }

    return {
      asset: coin.name,
      symbol: String(coin.symbol || "").toUpperCase(),
      action,
      confidence,
      target: formatUsd(target),
      current: formatUsd(price),
      reasoning,
    };
  });

  return {
    predictions,
    fallback: true,
    message: "AI credits are unavailable, so predictions are using market-based fallback logic.",
  };
};

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

    const marketSummary = coins
      .map(
        (c: any) =>
          `${c.name} (${c.symbol}): Price $${c.price}, 24h change ${c.change24h}%, Market Cap $${c.marketCap}, Volume $${c.volume}, 24h High $${c.high24h}, 24h Low $${c.low24h}`
      )
      .join("\n");

    const systemPrompt = `You are an expert crypto market analyst AI. Analyze real-time market data and provide actionable trading predictions. You must respond ONLY by calling the provided tool. Consider:
- Price momentum and 24h change direction
- Volume relative to market cap (high volume = conviction)
- Distance from 24h high/low (proximity to high = potential resistance, proximity to low = potential support)
- Overall market sentiment based on the basket of coins

Be decisive. Give clear BUY, SELL, or HOLD signals with realistic target prices and confidence scores (50-98%). Provide a brief 1-2 sentence reasoning for each.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze these cryptocurrencies and provide predictions for each:\n\n${marketSummary}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_predictions",
              description: "Return trading predictions for the analyzed cryptocurrencies.",
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
                        confidence: { type: "number", description: "Confidence 50-98" },
                        target: { type: "string", description: "Target price with $ sign" },
                        current: { type: "string", description: "Current price with $ sign" },
                        reasoning: { type: "string", description: "1-2 sentence reasoning" },
                      },
                      required: ["asset", "symbol", "action", "confidence", "target", "current", "reasoning"],
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
        return new Response(JSON.stringify(buildFallbackPredictions(coins)), {
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
