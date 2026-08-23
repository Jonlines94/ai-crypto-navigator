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
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
}

interface Gem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change1h: number | null;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume: number;
  rank: number | null;
  potentialScore: number;
  reason: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  trending: boolean;
  verified: boolean;
  verificationNote: string | null;
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

// ---------- Binance 1h technical snapshot (best-effort, only if a USDT pair exists) ----------
async function binanceTech(symbol: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://data-api.binance.vision/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=1h&limit=60`
    );
    if (!res.ok) return null;
    const k = await res.json();
    if (!Array.isArray(k) || k.length < 30) return null;

    const closes = k.map((x: any[]) => parseFloat(x[4]));
    const vols = k.map((x: any[]) => parseFloat(x[5]));

    // RSI(14)
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    const rsi = losses === 0 ? 100 : Math.round((100 - 100 / (1 + gains / losses)) * 10) / 10;

    // EMA9/21 trend
    const emaOf = (vals: number[], p: number) => {
      const kk = 2 / (p + 1);
      let e = vals[0];
      for (let i = 1; i < vals.length; i++) e = vals[i] * kk + e * (1 - kk);
      return e;
    };
    const trendUp = emaOf(closes.slice(-30), 9) >= emaOf(closes.slice(-30), 21);

    // MACD histogram (12/26/9)
    const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10;
    let e12 = closes[0], e26 = closes[0], sig = 0, hist = 0, prevHist = 0;
    for (let i = 1; i < closes.length; i++) {
      e12 = closes[i] * k12 + e12 * (1 - k12);
      e26 = closes[i] * k26 + e26 * (1 - k26);
      const m = e12 - e26;
      sig = i === 1 ? m : m * k9 + sig * (1 - k9);
      prevHist = hist;
      hist = m - sig;
    }

    // Volume ratio: last 6h vs prior avg
    const recent = vols.slice(-6).reduce((a, b) => a + b, 0) / 6;
    const prior = vols.slice(0, -6).reduce((a, b) => a + b, 0) / Math.max(vols.length - 6, 1);
    const volRatio = prior > 0 ? (recent / prior).toFixed(2) : "1.00";

    return `1h RSI ${rsi}, MACD ${hist > 0 ? "POS" : "NEG"}(${hist > prevHist ? "rising" : "fading"}), 1h trend ${trendUp ? "UP" : "DOWN"}, vol ${volRatio}x avg`;
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

  const turnoverPts = Math.min(turnover * 60, 25);
  score += turnoverPts;
  if (turnover > 0.15) parts.push(`high turnover ${(turnover * 100).toFixed(0)}%`);

  if (chg24 > 0 && chg24 <= 8) { score += 18; parts.push(`+${chg24.toFixed(1)}% 24h momentum`); }
  else if (chg24 > 8 && chg24 <= 15) { score += 9; parts.push(`strong +${chg24.toFixed(1)}% 24h move`); }
  else if (chg24 > 15) { score += 3; parts.push("24h move may be extended"); }
  else if (chg24 <= 0 && chg24 > -6 && chg7d > 0) { score += 10; parts.push("pullback entry in 7d uptrend"); }

  if (chg7d > 0 && chg7d <= 25) { score += 14; parts.push(`+${chg7d.toFixed(1)}% 7d trend`); }
  else if (chg7d > 25 && chg7d <= 50) { score += 6; }
  else if (chg7d > 50) { score += 1; parts.push("7d move overextended"); }

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

function coinLine(c: RawCoin, extra = ""): string {
  const chg1h = c.price_change_percentage_1h_in_currency;
  return `${c.name} (${c.symbol.toUpperCase()}): price $${c.current_price}, ${chg1h != null ? `1h ${chg1h.toFixed(2)}%, ` : ""}24h ${(c.price_change_percentage_24h_in_currency ?? 0).toFixed(2)}%, 7d ${(c.price_change_percentage_7d_in_currency ?? 0).toFixed(2)}%, mcap $${(c.market_cap / 1e6).toFixed(1)}M, vol $${(c.total_volume / 1e6).toFixed(1)}M, turnover ${((c.total_volume / c.market_cap) * 100).toFixed(1)}%, rank #${c.market_cap_rank ?? "?"}${extra}`;
}

function toGem(c: RawCoin, score: number, reason: string, trendingIds: Set<string>): Gem {
  return {
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    image: c.image,
    price: c.current_price,
    change1h: c.price_change_percentage_1h_in_currency != null
      ? Math.round(c.price_change_percentage_1h_in_currency * 100) / 100
      : null,
    change24h: Math.round((c.price_change_percentage_24h_in_currency ?? 0) * 100) / 100,
    change7d: Math.round((c.price_change_percentage_7d_in_currency ?? 0) * 100) / 100,
    marketCap: c.market_cap,
    volume: c.total_volume,
    rank: c.market_cap_rank,
    potentialScore: Math.max(1, Math.min(Math.round(score), 98)),
    reason,
    risk: riskOf(c),
    trending: trendingIds.has(c.id),
    verified: false,
    verificationNote: null,
  };
}

async function aiCall(apiKey: string, systemPrompt: string, userContent: string, tool: any): Promise<any> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw Object.assign(new Error("Rate limited, try again shortly."), { status: 429 });
    if (status === 402) throw Object.assign(new Error("AI credits exhausted"), { status: 402 });
    const t = await response.text();
    throw new Error(`AI gateway error: ${status} - ${t}`);
  }

  const aiData = await response.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");
  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Stage 1: broad scan — trending list + mid/small-cap market pages (ranks ~101-400)
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

    const candidates = all.filter((c) =>
      c.market_cap > 10e6 &&
      c.market_cap < 2e9 &&
      c.total_volume > 1e6 &&
      c.current_price > 0 &&
      // sanity filter: volume > 50x market cap is a data glitch, not real turnover
      c.total_volume < c.market_cap * 50
    );

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No market data available from CoinGecko right now." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stage 2: pre-score everything, shortlist top 25
    const preScored = candidates
      .map((c) => ({ c, ...scoreCoin(c, trendingIds) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    // Stage 3: re-fetch FRESH per-coin data for the shortlist (adds 1h change, latest price)
    const shortlistIds = preScored.map(({ c }) => c.id).join(",");
    const fresh: RawCoin[] | null = await fetchJson(
      `${CG}/coins/markets?vs_currency=usd&ids=${shortlistIds}&sparkline=false&price_change_percentage=1h,24h,7d`
    );
    const freshById = new Map<string, RawCoin>((fresh ?? []).map((c) => [c.id, c]));
    // Use fresh data where available, fall back to page data
    const working = preScored.map(({ c, score, reason }) => ({
      c: freshById.get(c.id) ?? c,
      score,
      reason,
    }));

    const dataAsOf = new Date().toISOString();

    // Stage 3b: live Binance 1h technicals for shortlisted symbols (best-effort)
    const uniqueSymbols = [...new Set(working.map(({ c }) => c.symbol.toUpperCase()))];
    const techResults = await Promise.all(uniqueSymbols.map((s) => binanceTech(s)));
    const techBySymbol = new Map<string, string>();
    uniqueSymbols.forEach((s, i) => {
      const t = techResults[i];
      if (t) techBySymbol.set(s, t);
    });

    const withTech = (c: RawCoin) => {
      const t = techBySymbol.get(c.symbol.toUpperCase());
      return t ? `, Binance 1h: ${t}` : "";
    };

    const candidateSummary = working.map(({ c, score }, i) =>
      `${i + 1}. ${coinLine(c, `, trending ${trendingIds.has(c.id) ? "YES" : "no"}, heuristic score ${score}${withTech(c)}`)}`
    ).join("\n");

    const pickPrompt = `You are an elite crypto analyst specializing in EARLY-STAGE and UP-AND-COMING coins — small and mid caps with real breakout potential BEFORE the crowd arrives.

You are given pre-screened candidates (ranks ~100-400, market cap $10M-$2B, >$1M daily volume) with FRESH data refetched seconds ago: price, 1h/24h/7d momentum, volume/turnover, trending status, and — where a Binance USDT pair exists — live 1h technicals (RSI, MACD histogram direction and slope, EMA trend, volume ratio vs average).

SELECTION FRAMEWORK:
1. VOLUME/TURNOVER: Rising volume vs market cap = smart money accumulating. High turnover (>15%) on a small cap is a strong early signal. Binance volume ratio >= 1.3x confirms the interest is happening NOW.
2. MOMENTUM QUALITY: Prefer coins up 1-10% over 24h with a positive 7d trend (early breakout) OVER coins already up 30%+ (you're late). A small pullback in a 7d uptrend can be a good entry. Use the 1h change to confirm the move is still alive RIGHT NOW.
3. TECHNICAL CONFIRMATION: When Binance 1h data is present, it must support the thesis — the strongest picks have 1h trend UP with a POSITIVE, rising MACD. Avoid picks where MACD is negative and fading with trend DOWN unless this is a confirmed oversold bounce (RSI < 35 with MACD rising).
4. TRENDING SIGNALS: CoinGecko trending status = retail attention arriving — bullish for small caps if momentum is fresh.
5. AVOID: overextended pumps (24h >20% AND 7d >50%), dead volume, and anything that looks like pure hype with no liquidity.
6. RISK HONESTY: smaller market cap = higher risk. Score potential and assign risk truthfully.

Pick the 6-10 BEST opportunities. For each: a potential score (50-98, where 90+ = exceptional setup), a specific 1-2 sentence reason citing the actual fresh numbers, and a risk rating (LOW >$500M mcap, MEDIUM $100M-$500M, HIGH <$100M).

Respond ONLY by calling the provided tool.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const buildFallback = () => ({
      gems: working.slice(0, 10).map(({ c, score, reason }) => toGem(c, score, reason, trendingIds)),
      fallback: true,
      scannedCount: candidates.length,
      dataAsOf,
      timestamp: dataAsOf,
    });

    if (!LOVABLE_API_KEY) {
      console.warn("No AI key — using heuristic scoring");
      return new Response(JSON.stringify(buildFallback()), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stage 4: AI picks from fresh data
    let result: any;
    try {
      result = await aiCall(LOVABLE_API_KEY, pickPrompt,
        `Evaluate these ${working.length} pre-screened up-and-coming candidates (fresh data as of ${dataAsOf}) and pick the best opportunities:\n\n${candidateSummary}`,
        {
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
        });
    } catch (e: any) {
      if (e?.status === 429) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e?.status === 402) {
        console.warn("AI credits exhausted — using heuristic scoring");
        return new Response(JSON.stringify(buildFallback()), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    const bySymbol = new Map(working.map(({ c }) => [c.symbol.toUpperCase(), c]));
    let gems: Gem[] = (result.picks ?? [])
      .map((p: any) => {
        const c = bySymbol.get(String(p.symbol).toUpperCase());
        if (!c) return null;
        const g = toGem(c, p.potentialScore, p.reason, trendingIds);
        g.risk = p.risk;
        return g;
      })
      .filter(Boolean)
      .sort((a: Gem, b: Gem) => b.potentialScore - a.potentialScore);

    if (gems.length === 0) {
      return new Response(JSON.stringify(buildFallback()), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stage 5: SECOND AI VERIFICATION PASS — re-check each pick against the fresh numbers
    const verifyPrompt = `You are a strict verification AI. Another analyst made draft picks of up-and-coming crypto coins. Your job is to VERIFY each pick against the FRESH market data (refetched seconds ago) — catch stale theses, contradicted momentum, or exaggerated claims.

For each pick:
- Check the reason against the ACTUAL fresh numbers (price, 1h/24h/7d change, turnover, volume) AND the live Binance 1h technicals when present (RSI, MACD, trend, volume ratio). If the numbers contradict the thesis (e.g. "accumulation" but 1h is dumping with negative fading MACD, or "fresh momentum" but 24h is +25%), mark verified=false and explain.
- Adjust the score up or down (max ±10) if the fresh data warrants it. Positive rising MACD in an uptrend supports a bump up; negative MACD against the thesis supports a cut.
- If the thesis holds against the fresh data, mark verified=true with a short confirmation note citing the key number.

Respond ONLY by calling the provided tool.`;

    try {
      const verifyResult = await aiCall(LOVABLE_API_KEY, verifyPrompt,
        `Verify these draft picks against the fresh data (as of ${dataAsOf}):\n\n` +
        gems.map((g) => {
          const c = bySymbol.get(g.symbol)!;
          return `PICK: ${coinLine(c, withTech(c))}\n  claim (score ${g.potentialScore}): ${g.reason}`;
        }).join("\n\n"),
        {
          type: "function",
          function: {
            name: "verify_picks",
            description: "Return verification verdicts for each draft pick",
            parameters: {
              type: "object",
              properties: {
                verdicts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string" },
                      verified: { type: "boolean", description: "true if the thesis holds against fresh data" },
                      adjustedScore: { type: "number", description: "Adjusted potential score 40-98" },
                      note: { type: "string", description: "Short verification note citing the key fresh number" },
                    },
                    required: ["symbol", "verified", "adjustedScore", "note"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["verdicts"],
              additionalProperties: false,
            },
          },
        });

      const verdictBySymbol = new Map<string, any>(
        (verifyResult.verdicts ?? []).map((v: any) => [String(v.symbol).toUpperCase(), v])
      );
      gems = gems
        .map((g) => {
          const v = verdictBySymbol.get(g.symbol);
          if (!v) return g;
          return {
            ...g,
            verified: !!v.verified,
            potentialScore: Math.max(1, Math.min(Math.round(v.adjustedScore ?? g.potentialScore), 98)),
            verificationNote: v.note ?? null,
          };
        })
        .sort((a, b) => b.potentialScore - a.potentialScore);
    } catch (e: any) {
      // Verification pass failing (402/429/etc.) must not lose the picks — return unverified
      console.warn("Verification pass failed:", e?.message ?? e);
    }

    return new Response(JSON.stringify({
      gems,
      outlook: result.outlook,
      fallback: false,
      scannedCount: candidates.length,
      dataAsOf,
      timestamp: dataAsOf,
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
