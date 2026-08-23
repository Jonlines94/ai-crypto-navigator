import { useLiveTransfers, type LargeTrade } from "@/hooks/useLiveTransfers";
import { ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";

const fmtUsd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;

const fmtPrice = (p: number) =>
  p >= 1 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.toFixed(6);

const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const TradeRow = ({ trade, isNew }: { trade: LargeTrade; isNew: boolean }) => (
  <tr
    className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${
      isNew ? "animate-pulse bg-primary/5" : ""
    }`}
  >
    <td className="py-2.5 px-4 text-xs font-mono text-primary">{fmtTime(trade.time)}</td>
    <td className="py-2.5 px-4">
      <span className="text-xs font-mono font-semibold text-foreground">{trade.base}</span>
      <span className="text-[10px] font-mono text-muted-foreground">/USDT</span>
    </td>
    <td className="py-2.5 px-4">
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
          trade.side === "BUY" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
        }`}
      >
        {trade.side === "BUY" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {trade.side}
      </span>
    </td>
    <td className="text-right py-2.5 px-4 text-xs font-mono text-foreground">
      {trade.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
      <span className="text-primary">{trade.base}</span>
    </td>
    <td className="text-right py-2.5 px-4 text-xs font-mono text-muted-foreground">${fmtPrice(trade.price)}</td>
    <td
      className={`text-right py-2.5 px-4 text-xs font-mono font-semibold ${
        trade.usd >= 500000 ? "text-primary" : "text-foreground"
      }`}
    >
      {fmtUsd(trade.usd)}
    </td>
  </tr>
);

const TransfersFeed = () => {
  const { trades, loading, error, newIds, refetch } = useLiveTransfers(15000);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Live Large Trades <span className="text-[10px] normal-case tracking-normal">($50K+ · Binance)</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Refresh trades"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className={`w-2 h-2 rounded-full ${error ? "bg-loss" : "bg-gain animate-pulse"}`} />
          <span className="text-[10px] font-mono text-muted-foreground">
            {error ? "ERROR" : "STREAMING"}
          </span>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-3 px-4 font-semibold">Time</th>
                <th className="text-left py-3 px-4 font-semibold">Pair</th>
                <th className="text-left py-3 px-4 font-semibold">Side</th>
                <th className="text-right py-3 px-4 font-semibold">Amount</th>
                <th className="text-right py-3 px-4 font-semibold">Price</th>
                <th className="text-right py-3 px-4 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs font-mono text-muted-foreground">
                    {error ? `Feed error: ${error}` : "No large trades detected in the last window — waiting for whales..."}
                  </td>
                </tr>
              ) : (
                trades.map((t) => <TradeRow key={t.id} trade={t} isNew={newIds.has(t.id)} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default TransfersFeed;
