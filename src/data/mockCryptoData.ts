export const tickerEntities = [
  { name: "Binance", value: "$98.2B", change: 2.41 },
  { name: "BlackRock", value: "$52.1B", change: 1.87 },
  { name: "Coinbase", value: "$89.7B", change: 2.9 },
  { name: "U.S. Government", value: "$12.3B", change: -0.42 },
  { name: "Grayscale", value: "$28.6B", change: -1.15 },
  { name: "MicroStrategy", value: "$44.8B", change: 3.62 },
  { name: "Tether Treasury", value: "$118.4B", change: 0.08 },
  { name: "Jump Trading", value: "$2.1B", change: -4.33 },
  { name: "Wintermute", value: "$1.8B", change: 5.12 },
  { name: "Vitalik Buterin", value: "$780M", change: -0.91 },
  { name: "FTX Estates", value: "$3.4B", change: 0.22 },
  { name: "Alameda Research", value: "$412M", change: -2.17 },
];

export const trendingInsights = [
  {
    tags: ["Bullish", "Pump"],
    title: "BTC Surges Past $105K as Institutional Inflows Hit Record $2.1B Weekly",
    time: "2 hours ago",
    updates: 8,
    tokens: ["BTC", "ETH"],
  },
  {
    tags: ["Bearish", "Whale"],
    title: "Whale Moves $340M ETH to Exchanges, Largest Single Transfer in 30 Days",
    time: "5 hours ago",
    updates: 4,
    tokens: ["ETH"],
  },
  {
    tags: ["Important", "Sentiment"],
    title: "SEC Delays Solana ETF Decision, Market Reacts with 6% Dip Across Altcoins",
    time: "8 hours ago",
    updates: 12,
    tokens: ["SOL", "AVAX"],
  },
  {
    tags: ["Whale", "Pump"],
    title: "PEPE Surges 42% as Three Whale Wallets Accumulate $89M in 24 Hours",
    time: "11 hours ago",
    updates: 6,
    tokens: ["PEPE"],
  },
];

export const aiPredictions = [
  { asset: "BTC", action: "BUY" as const, confidence: 94, target: "$112,400", current: "$105,230", reasoning: "Institutional accumulation pattern detected. On-chain metrics show strong holder conviction with 78% supply in profit." },
  { asset: "ETH", action: "SELL" as const, confidence: 72, target: "$3,180", current: "$3,640", reasoning: "Whale distribution detected. Exchange inflows up 340% in 48h. RSI overbought on 4H timeframe." },
  { asset: "SOL", action: "BUY" as const, confidence: 87, target: "$198", current: "$172", reasoning: "DEX volume surge with TVL increasing 23% WoW. Strong developer activity and NFT market recovery." },
  { asset: "AVAX", action: "BUY" as const, confidence: 68, target: "$42.80", current: "$38.50", reasoning: "Subnet adoption accelerating. Institutional interest growing with 3 new fund allocations this week." },
  { asset: "DOGE", action: "SELL" as const, confidence: 81, target: "$0.12", current: "$0.18", reasoning: "Social sentiment declining. Top 10 wallets reducing positions by 15% over 7 days. Volume dropping." },
  { asset: "LINK", action: "BUY" as const, confidence: 91, target: "$22.40", current: "$18.90", reasoning: "CCIP adoption expanding. 12 new chain integrations announced. Staking TVL at all-time high." },
];

export const exchangeFlows = [
  { asset: "BTC", price: "$105,230", priceChange: 2.41, volume: "$48.2B", netflow: "+$892M", netflowPct: 12.3 },
  { asset: "ETH", price: "$3,640", priceChange: -1.23, volume: "$22.1B", netflow: "-$340M", netflowPct: -8.7 },
  { asset: "SOL", price: "$172.40", priceChange: 5.67, volume: "$8.9B", netflow: "+$125M", netflowPct: 15.2 },
  { asset: "BNB", price: "$612.30", priceChange: 0.89, volume: "$3.2B", netflow: "+$45M", netflowPct: 3.1 },
  { asset: "XRP", price: "$2.34", priceChange: -2.11, volume: "$5.6B", netflow: "-$78M", netflowPct: -5.4 },
  { asset: "AVAX", price: "$38.50", priceChange: 3.45, volume: "$1.8B", netflow: "+$32M", netflowPct: 7.8 },
  { asset: "DOGE", price: "$0.18", priceChange: -4.23, volume: "$4.1B", netflow: "-$112M", netflowPct: -14.2 },
  { asset: "LINK", price: "$18.90", priceChange: 6.12, volume: "$1.2B", netflow: "+$28M", netflowPct: 9.4 },
];

export const transfers = [
  { time: "just now", from: "0xB09F...4a5C", to: "Binance Hot Wallet", value: "142.5", token: "ETH", usd: "$518,700" },
  { time: "just now", from: "Coinbase", to: "0x7aE2...9d1B", value: "3.2", token: "BTC", usd: "$336,736" },
  { time: "2s ago", from: "0xd4C1...8e3F", to: "Kraken", value: "45,200", token: "SOL", usd: "$7,792,480" },
  { time: "5s ago", from: "Jump Trading", to: "0x2bA8...c7D4", value: "1,200,000", token: "USDC", usd: "$1,200,000" },
  { time: "8s ago", from: "0x91F3...2a6E", to: "OKX", value: "892", token: "ETH", usd: "$3,246,880" },
  { time: "12s ago", from: "Wintermute", to: "Uniswap V3", value: "5,400,000", token: "PEPE", usd: "$48,600" },
  { time: "15s ago", from: "0xaB34...f1C9", to: "Binance", value: "12.8", token: "BTC", usd: "$1,346,944" },
  { time: "22s ago", from: "Grayscale", to: "0x5cD7...3e2A", value: "890", token: "ETH", usd: "$3,239,600" },
];
