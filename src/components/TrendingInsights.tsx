import { CoinData } from "@/hooks/useCryptoData";

interface TrendingInsightsProps {
  coins: CoinData[];
}

const TrendingInsights = ({ coins = [] }: TrendingInsightsProps) => {
  if (!coins || coins.length === 0) return null;

  const insights = generateInsights(coins);

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
        Trending Insights
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {insights.map((item, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer group"
          >
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {item.tags.map((tag) => (
                <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded ${tagColors[tag] || "bg-secondary text-secondary-foreground"}`}>
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-sm font-medium text-foreground leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2">
              {item.title}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Tokens: {item.tokens.join(", ")}</span>
              <span>Live data</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const tagColors: Record<string, string> = {
  Bullish: "bg-gain/20 text-gain border border-gain/30",
  Bearish: "bg-loss/20 text-loss border border-loss/30",
  Pump: "bg-primary/20 text-primary border border-primary/30",
  "High Volume": "bg-primary/20 text-primary border border-primary/30",
  Whale: "bg-primary/20 text-primary border border-primary/30",
  Important: "bg-warning/20 text-warning border border-warning/30",
  Sentiment: "bg-secondary text-secondary-foreground border border-border",
};

interface Insight {
  tags: string[];
  title: string;
  tokens: string[];
}

function generateInsights(coins: CoinData[]): Insight[] {
  const insights: Insight[] = [];
  const sorted24h = [...coins].sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0));

  // Top gainer
  const topGainer = sorted24h[0];
  if (topGainer && topGainer.price_change_percentage_24h > 0) {
    insights.push({
      tags: ["Bullish", "Pump"],
      title: `${topGainer.name} surges ${topGainer.price_change_percentage_24h.toFixed(1)}% to $${topGainer.current_price.toLocaleString()} leading market gains`,
      tokens: [topGainer.symbol.toUpperCase()],
    });
  }

  // Top loser
  const topLoser = sorted24h[sorted24h.length - 1];
  if (topLoser && topLoser.price_change_percentage_24h < 0) {
    insights.push({
      tags: ["Bearish", "Important"],
      title: `${topLoser.name} drops ${Math.abs(topLoser.price_change_percentage_24h).toFixed(1)}% amid market pressure, trading at $${topLoser.current_price.toLocaleString()}`,
      tokens: [topLoser.symbol.toUpperCase()],
    });
  }

  // Highest volume
  const byVolume = [...coins].sort((a, b) => b.total_volume - a.total_volume);
  const highVol = byVolume[0];
  if (highVol) {
    const volB = (highVol.total_volume / 1e9).toFixed(1);
    insights.push({
      tags: ["High Volume", "Sentiment"],
      title: `${highVol.name} leads trading volume at $${volB}B in 24 hours signaling strong market interest`,
      tokens: [highVol.symbol.toUpperCase()],
    });
  }

  // Market summary
  const gainers = coins.filter((c) => (c.price_change_percentage_24h ?? 0) > 0).length;
  const total = coins.length;
  insights.push({
    tags: [gainers > total / 2 ? "Bullish" : "Bearish", "Sentiment"],
    title: `Market sentiment: ${gainers}/${total} tokens in green. ${gainers > total / 2 ? "Bulls in control" : "Bears dominating"} across major cryptocurrencies`,
    tokens: sorted24h.slice(0, 3).map((c) => c.symbol.toUpperCase()),
  });

  return insights.slice(0, 4);
}

export default TrendingInsights;
