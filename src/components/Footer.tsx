import { Shield, Activity } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50 mt-8">
      <div className="max-w-[1440px] mx-auto px-4 py-6 space-y-4">
        {/* Status + disclaimer row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-gain" />
            <span className="text-[11px] font-mono tracking-wide">
              CryptoNexus AI · Real-time market intelligence & automated trading
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono">
              Not financial advice · Crypto trading carries risk of loss · Past performance ≠ future results
            </span>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Trademark row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p className="text-[11px] font-mono text-muted-foreground">
            © 2025 <span className="text-foreground font-semibold">Lines Dev Ltd</span>. All rights reserved.
          </p>
          <p className="text-[11px] font-mono text-muted-foreground">
            UK Copyright Service Registration No. <span className="text-foreground">284760522</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
