import { transfers } from "@/data/mockCryptoData";
import { ArrowRight } from "lucide-react";

const TransfersFeed = () => (
  <section>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Live Transfers
      </h2>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-gain animate-pulse" />
        <span className="text-[10px] font-mono text-muted-foreground">STREAMING</span>
      </div>
    </div>
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-3 px-4 font-semibold">Time</th>
              <th className="text-left py-3 px-4 font-semibold">From</th>
              <th className="text-left py-3 px-4 font-semibold" />
              <th className="text-left py-3 px-4 font-semibold">To</th>
              <th className="text-right py-3 px-4 font-semibold">Value</th>
              <th className="text-right py-3 px-4 font-semibold">USD</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((tx, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-2.5 px-4 text-xs font-mono text-primary">{tx.time}</td>
                <td className="py-2.5 px-4 text-xs font-mono text-muted-foreground truncate max-w-[140px]">{tx.from}</td>
                <td className="py-2.5 px-1"><ArrowRight className="w-3 h-3 text-muted-foreground/50" /></td>
                <td className="py-2.5 px-4 text-xs font-mono text-muted-foreground truncate max-w-[140px]">{tx.to}</td>
                <td className="text-right py-2.5 px-4 text-xs font-mono text-foreground">
                  {tx.value} <span className="text-primary">{tx.token}</span>
                </td>
                <td className="text-right py-2.5 px-4 text-xs font-mono text-muted-foreground">{tx.usd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export default TransfersFeed;
