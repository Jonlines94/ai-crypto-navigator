import { Search, Brain } from "lucide-react";

type Tab = "intel" | "gems" | "trading";

interface HeaderProps {
  activeTab?: Tab;
  onNavigate?: (tab: Tab) => void;
}

const Header = ({ activeTab, onNavigate }: HeaderProps) => (
  <header className="border-b border-border bg-card/30 backdrop-blur-sm">
    <div className="max-w-[1440px] mx-auto px-4 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Brain className="w-7 h-7 text-primary" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          CRYPTO<span className="text-primary">NEXUS</span>
          <span className="text-xs font-mono text-muted-foreground ml-2 align-middle">AI</span>
        </h1>
      </div>

      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tokens, wallets, entities..."
            className="w-full bg-secondary/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            ALL NETWORKS
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate?.("intel")}
          className={`text-sm transition-colors ${
            activeTab === "intel" || activeTab === "gems"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Markets
        </button>
        <button
          onClick={() => onNavigate?.("trading")}
          className={`text-sm transition-colors ${
            activeTab === "trading"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Tools
        </button>
        <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 transition-colors">
          Connect
        </button>
      </div>
    </div>
  </header>
);

export default Header;
