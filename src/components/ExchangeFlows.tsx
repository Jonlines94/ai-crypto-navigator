import { exchangeFlows } from "@/data/mockCryptoData";

const ExchangeFlows = () => (
  <section>
    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
      Exchange Flows
    </h2>
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-3 px-4 font-semibold">Asset</th>
              <th className="text-right py-3 px-4 font-semibold">Price</th>
              <th className="text-right py-3 px-4 font-semibold">24H Volume</th>
              <th className="text-right py-3 px-4 font-semibold">Netflow</th>
            </tr>
          </thead>
          <tbody>
            {exchangeFlows.map((row) => (
              <tr key={row.asset} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4">
                  <span className="text-sm font-semibold text-foreground">{row.asset}</span>
                </td>
                <td className="text-right py-3 px-4">
                  <span className="text-sm font-mono text-foreground">{row.price}</span>
                  <span className={`text-xs font-mono ml-2 ${row.priceChange >= 0 ? "text-gain" : "text-loss"}`}>
                    {row.priceChange >= 0 ? "+" : ""}{row.priceChange}%
                  </span>
                </td>
                <td className="text-right py-3 px-4 text-sm font-mono text-muted-foreground">{row.volume}</td>
                <td className="text-right py-3 px-4">
                  <span className={`text-sm font-mono font-semibold ${row.netflowPct >= 0 ? "text-gain" : "text-loss"}`}>
                    {row.netflow}
                  </span>
                  <span className={`text-xs font-mono ml-1 ${row.netflowPct >= 0 ? "text-gain" : "text-loss"}`}>
                    {row.netflowPct >= 0 ? "+" : ""}{row.netflowPct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export default ExchangeFlows;
