import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Brain, TrendingUp, TrendingDown, X } from "lucide-react";

interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
}

interface CoinDetail {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  ath: number;
  circulating_supply: number;
}

const fmtPrice = (p: number) => {
  if (p >= 1) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
};

const fmtBig = (v: number) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
};

const Header = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      setResults((data.coins || []).slice(0, 8));
      setOpen(true);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  const openDetail = async (id: string) => {
    setOpen(false);
    setQuery("");
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}&price_change_percentage=24h`
      );
      if (!res.ok) throw new Error(`Coin fetch failed: ${res.status}`);
      const data = await res.json();
      if (data?.[0]) {
        setDetail({
          ...data[0],
          image: data[0].image,
          symbol: data[0].symbol.toUpperCase(),
        });
      }
    } catch (err) {
      console.error("Coin detail error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <header className="relative z-50 border-b border-border bg-card/30 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Brain className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              CRYPTO<span className="text-primary">NEXUS</span>
              <span className="text-xs font-mono text-muted-foreground ml-2 align-middle">AI</span>
            </h1>
          </div>

          <div className="flex-1 max-w-xl relative" ref={boxRef}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${searching ? "animate-pulse" : ""}`} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (results.length > 0) setOpen(true); }}
                placeholder="Search any token... (e.g. bitcoin, SOL, pepe)"
                className="w-full bg-secondary/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>

            {open && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-[100]">
                {results.map((coin) => (
                  <button
                    key={coin.id}
                    onClick={() => openDetail(coin.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors text-left"
                  >
                    <img src={coin.thumb} alt={coin.name} className="w-5 h-5 rounded-full" />
                    <span className="text-sm font-medium text-foreground">{coin.name}</span>
                    <span className="text-xs font-mono text-muted-foreground uppercase">{coin.symbol}</span>
                    {coin.market_cap_rank && (
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        #{coin.market_cap_rank}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {open && !searching && query.trim().length >= 2 && results.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-2xl z-[100] px-4 py-3">
                <span className="text-xs text-muted-foreground">No tokens found for "{query}"</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 transition-colors">
              Connect
            </button>
          </div>
        </div>
      </header>

      {/* Coin detail modal */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detail ? (
              <>
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <img src={detail.image} alt={detail.name} className="w-10 h-10 rounded-full" />
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{detail.name}</h3>
                      <span className="text-xs font-mono text-muted-foreground">{detail.symbol}</span>
                    </div>
                  </div>
                  <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-baseline gap-3 mb-5">
                  <span className="text-3xl font-bold font-mono text-foreground">{fmtPrice(detail.current_price)}</span>
                  <span
                    className={`flex items-center gap-1 text-sm font-mono font-semibold ${
                      detail.price_change_percentage_24h >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {detail.price_change_percentage_24h >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {detail.price_change_percentage_24h?.toFixed(2)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Market Cap", fmtBig(detail.market_cap)],
                    ["24h Volume", fmtBig(detail.total_volume)],
                    ["24h High", fmtPrice(detail.high_24h)],
                    ["24h Low", fmtPrice(detail.low_24h)],
                    ["All-Time High", fmtPrice(detail.ath)],
                    ["Circulating", `${(detail.circulating_supply / 1e6).toFixed(1)}M ${detail.symbol}`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-secondary/30 rounded-lg px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                      <div className="font-mono font-semibold text-foreground">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
