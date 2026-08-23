import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CG = "https://api.coingecko.com/api/v3";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

async function cgFetch(url: string, attempts = 3): Promise<Response> {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.ok) return res;
    lastStatus = res.status;
    if (res.status === 429 && i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    break;
  }
  throw new Error(`CoinGecko error: ${lastStatus}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let id: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      id = body?.id ?? null;
    } else {
      id = new URL(req.url).searchParams.get("id");
    }
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return new Response(JSON.stringify({ error: "valid coin id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [coinRes, chartRes, tickerRes] = await Promise.all([
      cgFetch(
        `${CG}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`
      ),
      cgFetch(`${CG}/coins/${id}/market_chart?vs_currency=usd&days=7`).catch(() => null),
      cgFetch(`${CG}/coins/${id}/tickers?include_exchange_logo=true&page=1&depth=false&order=volume_desc`).catch(() => null),
    ]);

    const c = await coinRes.json();
    const md = c.market_data ?? {};

    let chart: [number, number][] = [];
    if (chartRes) {
      const ch = await chartRes.json();
      if (Array.isArray(ch?.prices)) chart = ch.prices;
    }

    // Top markets/exchanges where this coin trades (deduped per exchange+pair)
    let markets: unknown[] = [];
    if (tickerRes) {
      const tk = await tickerRes.json();
      if (Array.isArray(tk?.tickers)) {
        const seen = new Set<string>();
        markets = tk.tickers
          .filter((t: Record<string, unknown>) => {
            const ex = (t.market as Record<string, unknown>)?.name ?? "";
            const pair = `${t.base}/${t.target}`;
            const key = `${ex}:${pair}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return num((t.converted_volume as Record<string, unknown>)?.usd) > 0;
          })
          .slice(0, 10)
          .map((t: Record<string, unknown>) => ({
            exchange: (t.market as Record<string, unknown>)?.name ?? "Unknown",
            exchangeLogo: (t.market as Record<string, unknown>)?.logo ?? null,
            pair: `${t.base}/${t.target}`,
            price: num((t.converted_last as Record<string, unknown>)?.usd ?? t.last),
            volume: num((t.converted_volume as Record<string, unknown>)?.usd),
            trustScore: t.trust_score ?? null,
            tradeUrl: t.trade_url ?? null,
          }));
      }
    }

    const detail = {
      name: c.name,
      symbol: String(c.symbol ?? "").toUpperCase(),
      image: c.image?.large || c.image?.small || null,
      rank: c.market_cap_rank ?? null,
      price: num(md.current_price?.usd),
      change1h: num(md.price_change_percentage_1h_in_currency?.usd),
      change24h: num(md.price_change_percentage_24h),
      change7d: num(md.price_change_percentage_7d),
      change30d: num(md.price_change_percentage_30d),
      marketCap: num(md.market_cap?.usd),
      fdv: num(md.fully_diluted_valuation?.usd),
      volume: num(md.total_volume?.usd),
      high24h: num(md.high_24h?.usd),
      low24h: num(md.low_24h?.usd),
      ath: num(md.ath?.usd),
      athChange: num(md.ath_change_percentage?.usd),
      atl: num(md.atl?.usd),
      atlChange: num(md.atl_change_percentage?.usd),
      circulating: num(md.circulating_supply),
      totalSupply: md.total_supply ?? null,
      maxSupply: md.max_supply ?? null,
      description: String(c.description?.en || "")
        .replace(/<[^>]*>/g, "")
        .split(". ")
        .slice(0, 3)
        .join(". "),
      homepage: (c.links?.homepage || []).find((h: string) => h) || null,
      explorer: (c.links?.blockchain_site || []).find((h: string) => h) || null,
    };

    return new Response(JSON.stringify({ detail, chart }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coin-detail error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
