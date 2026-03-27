import { tickerEntities } from "@/data/mockCryptoData";

const TickerBar = () => {
  const items = [...tickerEntities, ...tickerEntities];

  return (
    <div className="w-full overflow-hidden border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="animate-ticker flex whitespace-nowrap py-2.5">
        {items.map((entity, i) => (
          <div key={i} className="flex items-center gap-2 px-5 border-r border-border/50">
            <span className="text-sm font-medium text-foreground">{entity.name}</span>
            <span className="text-sm font-mono text-muted-foreground">{entity.value}</span>
            <span className={`text-xs font-mono font-semibold ${entity.change >= 0 ? "text-gain" : "text-loss"}`}>
              {entity.change >= 0 ? "+" : ""}{entity.change}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TickerBar;
