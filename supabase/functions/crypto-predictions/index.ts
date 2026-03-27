import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402,
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
