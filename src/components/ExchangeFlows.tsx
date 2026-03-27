import { CoinData, formatPrice, formatVolume } from "@/hooks/useCryptoData";

interface ExchangeFlowsProps {
  coins: CoinData[];
  loading: boolean;
}

const ExchangeFlows = ({ coins = [], loading }: ExchangeFlowsProps) => (
  <section>
    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
      Market Overview
    </h2>
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-3 px-4 font-semibold">#</th>
              <th className="text-left py-3 px-4 font-semibold">Asset</th>
              <th className="text-right py-3 px-4 font-semibold">Price</th>
              <th className="text-right py-3 px-4 font-semibold">24h</th>
              <th className="text-right py-3 px-4 font-semibold">Volume</th>
              <th className="text-right py-3 px-4 font-semibold">Market Cap</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50 animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 w-4 bg-secondary rounded" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-20 bg-secondary rounded" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-secondary rounded ml-auto" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-12 bg-secondary rounded ml-auto" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-secondary rounded ml-auto" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-secondary rounded ml-auto" /></td>
                  </tr>
                ))
              : coins.map((coin, i) => (
                  <tr key={coin.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <img src={coin.image} alt={coin.name} className="w-5 h-5 rounded-full" />
                        <span className="text-sm font-semibold text-foreground">{coin.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{coin.symbol.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-sm font-mono text-foreground">{formatPrice(coin.current_price)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`text-sm font-mono font-semibold ${coin.price_change_percentage_24h >= 0 ? "text-gain" : "text-loss"}`}>
                        {coin.price_change_percentage_24h >= 0 ? "+" : ""}{coin.price_change_percentage_24h?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-sm font-mono text-muted-foreground">{formatVolume(coin.total_volume)}</td>
                    <td className="text-right py-3 px-4 text-sm font-mono text-muted-foreground">{formatVolume(coin.market_cap)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export default ExchangeFlows;
