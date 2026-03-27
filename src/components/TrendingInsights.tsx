import { trendingInsights } from "@/data/mockCryptoData";

const tagColors: Record<string, string> = {
  Bullish: "bg-gain/20 text-gain border border-gain/30",
  Bearish: "bg-loss/20 text-loss border border-loss/30",
  Pump: "bg-primary/20 text-primary border border-primary/30",
  Whale: "bg-primary/20 text-primary border border-primary/30",
  Important: "bg-warning/20 text-warning border border-warning/30",
  Sentiment: "bg-secondary text-secondary-foreground border border-border",
};

const TrendingInsights = () => (
  <section>
    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
      Trending Insights
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {trendingInsights.map((item, i) => (
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
            <span>{item.time} · {item.updates} updates</span>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default TrendingInsights;
