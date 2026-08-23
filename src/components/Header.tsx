import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Brain } from "lucide-react";
import CoinDetailModal from "./CoinDetailModal";
import type { AiPrediction } from "@/hooks/useAiPredictions";

interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
}

interface HeaderProps {
  predictions?: AiPrediction[];
}

const Header = ({ predictions = [] }: HeaderProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
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

  const openDetail = (id: string) => {
    setOpen(false);
    setQuery("");
    setSelectedCoinId(id);
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

      {selectedCoinId && (
        <CoinDetailModal
          coinId={selectedCoinId}
          predictions={predictions}
          onClose={() => setSelectedCoinId(null)}
        />
      )}
    </>
  );
};

export default Header;
