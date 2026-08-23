import { useState } from "react";
import { useLiveTransfers, type LargeTrade } from "@/hooks/useLiveTransfers";
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  X,
  ExternalLink,
  Building2,
  User,
  Clock,
  Hash,
  Layers,
} from "lucide-react";

const fmtUsd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;

const fmtPrice = (p: number) =>
  p >= 1 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.toFixed(6);

const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtFullTime = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const DetailRow = ({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className={`text-xs text-foreground text-right ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

const TradeDetailModal = ({ trade, onClose }: { trade: LargeTrade; onClose: () => void }) => {
  const isBuy = trade.side === "BUY";
  const binanceUrl = `https://www.binance.com/en/trade/${trade.base}_USDT`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center ${
                isBuy ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
              }`}
            >
              {isBuy ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-sm font-mono font-bold text-foreground">
                {trade.base}
                <span className="text-muted-foreground font-normal">/USDT</span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Whale {isBuy ? "Buy" : "Sell"} Detected
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Value hero */}
        <div className="px-5 py-4 border-b border-border/50 text-center">
          <div className={`text-3xl font-mono font-bold ${isBuy ? "text-gain" : "text-loss"}`}>
            {fmtUsd(trade.usd)}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">
            Total Trade Value
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-3">
          <DetailRow
            label="Who"
            value={
              <span className="flex items-center gap-1.5 justify-end">
                <User className="w-3 h-3 text-muted-foreground" />
                {isBuy ? "Buyer-initiated (taker buy)" : "Seller-initiated (taker sell)"}
              </span>
            }
          />
          <DetailRow
            label="Where"
            value={
              <span className="flex items-center gap-1.5 justify-end">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                {trade.exchange || "Binance Spot"} · {trade.symbol}
              </span>
            }
          />
          <DetailRow label="Price" value={`$${fmtPrice(trade.price)}`} />
          <DetailRow
            label="Amount"
            value={`${trade.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${trade.base}`}
          />
          <DetailRow
            label="Time"
            value={
              <span className="flex items-center gap-1.5 justify-end">
                <Clock className="w-3 h-3 text-muted-foreground" />
                {fmtFullTime(trade.time)}
              </span>
            }
          />
          {trade.aggTradeId !== undefined && (
            <DetailRow
              label="Trade ID"
              value={
                <span className="flex items-center gap-1.5 justify-end">
                  <Hash className="w-3 h-3 text-muted-foreground" />
                  {trade.aggTradeId}
                </span>
              }
            />
          )}
          {trade.fillCount !== undefined && trade.fillCount > 1 && (
            <DetailRow
              label="Fills"
              value={
                <span className="flex items-center gap-1.5 justify-end">
                  <Layers className="w-3 h-3 text-muted-foreground" />
                  Aggregated from {trade.fillCount} fills
                </span>
              }
            />
          )}
        </div>

        {/* Interpretation */}
        <div className="px-5 pb-3">
          <div
            className={`text-[11px] font-mono leading-relaxed rounded-md px-3 py-2.5 border ${
              isBuy
                ? "bg-gain/5 border-gain/20 text-gain/90"
                : "bg-loss/5 border-loss/20 text-loss/90"
            }`}
          >
            {isBuy
              ? `A large market participant aggressively BOUGHT ${trade.base} on Binance, lifting the ask. Taker-side buying at this size often signals accumulation.`
              : `A large market participant aggressively SOLD ${trade.base} on Binance, hitting the bid. Taker-side selling at this size often signals distribution or exit.`}
          </div>
        </div>

        {/* Footer link */}
        <div className="px-5 pb-5">
          <a
            href={binanceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-semibold hover:bg-primary/20 transition-colors"
          >
            View {trade.base}/USDT on Binance <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

const TradeRow = ({
  trade,
  isNew,
  onSelect,
}: {
  trade: LargeTrade;
  isNew: boolean;
  onSelect: (t: LargeTrade) => void;
}) => (
  <tr
    onClick={() => onSelect(trade)}
    className={`border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer ${
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
    <td className="text-right py-2.5 px-4 text-xs font-mono text-muted-foreground hidden sm:table-cell">
      ${fmtPrice(trade.price)}
    </td>
    <td className="text-right py-2.5 px-4 text-xs font-mono font-semibold text-primary">
      {fmtUsd(trade.usd)}
    </td>
  </tr>
);

const TransfersFeed = () => {
  const { trades, loading, error, newIds, refetch } = useLiveTransfers(15000);
  const [selected, setSelected] = useState<LargeTrade | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Live Whale Trades <span className="text-[10px] normal-case tracking-normal">($500K+ · Binance)</span>
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
                <th className="text-right py-3 px-4 font-semibold hidden sm:table-cell">Price</th>
                <th className="text-right py-3 px-4 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs font-mono text-muted-foreground">
                    {error
                      ? `Feed error: ${error}`
                      : "No $500K+ trades detected in the last window — waiting for whales..."}
                  </td>
                </tr>
              ) : (
                trades.map((t) => (
                  <TradeRow key={t.id} trade={t} isNew={newIds.has(t.id)} onSelect={setSelected} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-border/50 text-[10px] font-mono text-muted-foreground">
          Tap any trade for full details
        </div>
      </div>
      {selected && <TradeDetailModal trade={selected} onClose={() => setSelected(null)} />}
    </section>
  );
};

export default TransfersFeed;
