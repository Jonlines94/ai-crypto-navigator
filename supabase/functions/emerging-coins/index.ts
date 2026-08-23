import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RawCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  market_cap_rank: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
}

interface Gem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume: number;
  rank: number | null;
  potentialScore: number;
  reason: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  trending: boolean;
}

const CG = "https://api.coingecko.com/api/v3";

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------- Deterministic potential scoring ----------
function scoreCoin(c: RawCoin, trendingIds: Set<string>): { score: number; reason: string } {
  const chg24 = c.price_change_percentage_24h_in_currency ?? 0;
  const chg7d = c.price_change_percentage_7d_in_currency ?? 0;
  const turnover = c.market_cap > 0 ? c.total_volume / c.market_cap : 0;
  const parts: string[] = [];
  let score = 30;

  // Turnover (volume / mcap) — market interest
  const turnoverPts = Math.min(turnover * 60, 25);
  score += turnoverPts;
  if (turnover > 0.15) parts.push(`high turnover ${(turnover * 100).toFixed(0)}%`);

  // 24h momentum — building but not blown off
  if (chg24 > 0 && chg24 <= 8) { score += 18; parts.push(`+${chg24.toFixed(1)}% 24h momentum`); }
  else if (chg24 > 8 && chg24 <= 15) { score += 9; parts.push(`strong +${chg24.toFixed(1)}% 24h move`); }
  else if (chg24 > 15) { score += 3; parts.push("24h move may be extended"); }
  else if (chg24 <= 0 && chg24 > -6 && chg7d > 0) { score += 10; parts.push("pullback entry in 7d uptrend"); }

  // 7d trend
  if (chg7d > 0 && chg7d <= 25) { score += 14; parts.push(`+${chg7d.toFixed(1)}% 7d trend`); }
  else if (chg7d > 25 && chg7d <= 50) { score += 6; }
  else if (chg7d > 50) { score += 1; parts.push("7d move overextended"); }

  // Trending boost
  if (trendingIds.has(c.id)) { score += 15; parts.push("trending on CoinGecko"); }

  return {
    score: Math.max(1, Math.min(Math.round(score), 96)),
    reason: parts.length > 0
      ? `Heuristic: ${parts.join(", ")}. Vol $${(c.total_volume / 1e6).toFixed(1)}M vs mcap $${(c.market_cap / 1e6).toFixed(0)}M.`
      : `Heuristic: neutral momentum, vol $${(c.total_volume / 1e6).toFixed(1)}M.`,
  };
}

function riskOf(c: RawCoin): Gem["risk"] {
  if (c.market_cap > 500e6) return "LOW";
  if (c.market_cap > 100e6) return "MEDIUM";
  return "HIGH";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Fetch trending list + mid/small-cap market pages (ranks ~101-400) in parallel
    const [trendingData, page2, page3, page4] = await Promise.all([
      fetchJson(`${CG}/search/trending`),
      fetchJson(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=2&sparkline=false&price_change_percentage=24h,7d`),
      fetchJson(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=3&sparkline=false&price_change_percentage=24h,7d`),
      fetchJson(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=4&sparkline=false&price_change_percentage=24h,7d`),
    ]);

    const trendingIds = new Set<string>(
      (trendingData?.coins ?? []).map((c: any) => c?.item?.id).filter(Boolean)
    );

    const all: RawCoin[] = [...(page2 ?? []), ...(page3 ?? []), ...(page4 ?? [])];

    // "Up and coming": established enough to have liquidity, small enough to have room to grow
    const candidates = all.filter((c) =>
      c.market_cap > 10e6 &&
      c.market_cap < 2e9 &&
      c.total_volume > 1e6 &&
      c.current_price > 0
    );

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No market data available from CoinGecko right now." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-score everything, take top 25 for the AI to evaluate
    const preScored = candidates
      .map((c) => ({ c, ...scoreCoin(c, trendingIds) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    const candidateSummary = preScored.map(({ c, score }, i) =>
      `${i + 1}. ${c.name} (${c.symbol.toUpperCase()}): price $${c.current_price}, 24h ${(c.price_change_percentage_24h_in_currency ?? 0).toFixed(2)}%, 7d ${(c.price_change_percentage_7d_in_currency ?? 0).toFixed(2)}%, mcap $${(c.market_cap / 1e6).toFixed(1)}M, vol $${(c.total_volume / 1e6).toFixed(1)}M, turnover ${((c.total_volume / c.market_cap) * 100).toFixed(1)}%, rank #${c.market_cap_rank ?? "?"}, trending ${trendingIds.has(c.id) ? "YES" : "no"}, heuristic score ${score}`
    ).join("\n");

    const systemPrompt = `You are an elite crypto analyst specializing in EARLY-STAGE and UP-AND-COMING coins — small and mid caps with real breakout potential BEFORE the crowd arrives.

You are given pre-screened candidates (ranks ~100-400, market cap $10M-$2B, >$1M daily volume) with price, momentum, volume/turnover, and trending data.

SELECTION FRAMEWORK:
1. VOLUME/TURNOVER: Rising volume vs market cap = smart money accumulating. High turnover (>15%) on a small cap is a strong early signal.
2. MOMENTUM QUALITY: Prefer coins up 1-10% over 24h with a positive 7d trend (early breakout) OVER coins already up 30%+ (you're late). A small pullback in a 7d uptrend can be a good entry.
3. TRENDING SIGNALS: CoinGecko trending status = retail attention arriving — bullish for small caps if momentum is fresh.
4. AVOID: overextended pumps (24h >20% AND 7d >50%), dead volume, and anything that looks like pure hype with no liquidity.
5. RISK HONESTY: smaller market cap = higher risk. Score potential and assign risk truthfully.

Pick the 6-10 BEST opportunities. For each: a potential score (50-98, where 90+ = exceptional setup), a specific 1-2 sentence reason citing the actual numbers, and a risk rating (LOW >$500M mcap, MEDIUM $100M-$500M, HIGH <$100M).

Respond ONLY by calling the provided tool.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const buildFallback = () => {
      const gems: Gem[] = preScored.slice(0, 10).map(({ c, score, reason }) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        image: c.image,
        price: c.current_price,
        change24h: Math.round((c.price_change_percentage_24h_in_currency ?? 0) * 100) / 100,
        change7d: Math.round((c.price_change_percentage_7d_in_currency ?? 0) * 100) / 100,
        marketCap: c.market_cap,
        volume: c.total_volume,
        rank: c.market_cap_rank,
        potentialScore: score,
        reason,
        risk: riskOf(c),
        trending: trendingIds.has(c.id),
      }));
      return { gems, fallback: true, scannedCount: candidates.length, timestamp: new Date().toISOString() };
    };

    if (!LOVABLE_API_KEY) {
      console.warn("No AI key — using heuristic scoring");
      return new Response(JSON.stringify(buildFallback()), {
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
          { role: "user", content: `Evaluate these ${preScored.length} pre-screened up-and-coming candidates and pick the best opportunities:\n\n${candidateSummary}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "pick_gems",
            description: "Return the best up-and-coming coin picks with potential scores",
            parameters: {
              type: "object",
              properties: {
                picks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string", description: "Coin ticker symbol e.g. FET" },
                      potentialScore: { type: "number", description: "Potential score 50-98" },
                      reason: { type: "string", description: "1-2 sentence reason citing actual numbers" },
                      risk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                    },
                    required: ["symbol", "potentialScore", "reason", "risk"],
                    additionalProperties: false,
                  },
                },
                outlook: { type: "string", description: "1-2 sentence summary of the small/mid-cap opportunity landscape right now" },
              },
              required: ["picks", "outlook"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "pick_gems" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        console.warn("AI credits exhausted — using heuristic scoring");
        return new Response(JSON.stringify(buildFallback()), {
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

    // Merge AI picks with raw market data
    const bySymbol = new Map(preScored.map(({ c }) => [c.symbol.toUpperCase(), c]));
    const gems: Gem[] = (result.picks ?? [])
      .map((p: any) => {
        const c = bySymbol.get(String(p.symbol).toUpperCase());
        if (!c) return null;
        return {
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          image: c.image,
          price: c.current_price,
          change24h: Math.round((c.price_change_percentage_24h_in_currency ?? 0) * 100) / 100,
          change7d: Math.round((c.price_change_percentage_7d_in_currency ?? 0) * 100) / 100,
          marketCap: c.market_cap,
          volume: c.total_volume,
          rank: c.market_cap_rank,
          potentialScore: Math.max(1, Math.min(Math.round(p.potentialScore), 98)),
          reason: p.reason,
          risk: p.risk,
          trending: trendingIds.has(c.id),
        } as Gem;
      })
      .filter(Boolean)
      .sort((a: Gem, b: Gem) => b.potentialScore - a.potentialScore);

    if (gems.length === 0) {
      return new Response(JSON.stringify(buildFallback()), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      gems,
      outlook: result.outlook,
      fallback: false,
      scannedCount: candidates.length,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("emerging-coins error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
