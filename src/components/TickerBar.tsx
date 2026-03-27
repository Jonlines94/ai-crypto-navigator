import { CoinData, formatPrice, formatMarketCap } from "@/hooks/useCryptoData";

interface TickerBarProps {
  coins: CoinData[];
  loading: boolean;
}

const TickerBar = ({ coins, loading }: TickerBarProps) => {
  if (loading || coins.length === 0) {
    return (
      <div className="w-full overflow-hidden border-b border-border bg-card/50 backdrop-blur-sm py-3">
        <div className="flex items-center justify-center">
          <span className="text-xs font-mono text-muted-foreground animate-pulse">Loading live market data...</span>
        </div>
      </div>
    );
  }

  const items = [...coins, ...coins];

  return (
    <div className="w-full overflow-hidden border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="animate-ticker flex whitespace-nowrap py-2.5">
        {items.map((coin, i) => (
          <div key={`${coin.id}-${i}`} className="flex items-center gap-2 px-5 border-r border-border/50">
            <img src={coin.image} alt={coin.name} className="w-4 h-4 rounded-full" />
            <span className="text-sm font-medium text-foreground">{coin.name}</span>
            <span className="text-sm font-mono text-muted-foreground">{formatPrice(coin.current_price)}</span>
            <span className="text-sm font-mono text-muted-foreground">{formatMarketCap(coin.market_cap)}</span>
            <span className={`text-xs font-mono font-semibold ${coin.price_change_percentage_24h >= 0 ? "text-gain" : "text-loss"}`}>
              {coin.price_change_percentage_24h >= 0 ? "+" : ""}{coin.price_change_percentage_24h?.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TickerBar;
