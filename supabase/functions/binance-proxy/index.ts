// Binance Trading API v3 - Web Crypto HMAC
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BINANCE_BASE = "https://api.binance.com";
// Unrestricted public market-data host (no geo block)
const MARKET_DATA_BASE = "https://data-api.binance.vision";
// Fallback hosts for signed endpoints
const SIGNED_HOSTS = [
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

async function hmacSign(queryString: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(queryString));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function binanceReq(method: string, endpoint: string, params: Record<string, string> = {}, signed = false, retries = 2): Promise<any> {
  const apiKey = Deno.env.get("BINANCE_API_KEY");
  const apiSecret = Deno.env.get("BINANCE_API_SECRET");
  if (!apiKey || !apiSecret) throw new Error("Binance API keys not configured");
  const headers: Record<string, string> = { "X-MBX-APIKEY": apiKey };

  const hosts = signed ? SIGNED_HOSTS : [MARKET_DATA_BASE, ...SIGNED_HOSTS];
  let lastErr: Error | null = null;

  for (const base of hosts) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const p = { ...params };
        if (signed) { p.timestamp = Date.now().toString(); p.recvWindow = "10000"; }
        const qs = new URLSearchParams(p).toString();
        let url: string;
        if (signed) { const sig = await hmacSign(qs, apiSecret); url = `${base}${endpoint}?${qs}&signature=${sig}`; }
        else { url = `${base}${endpoint}${qs ? `?${qs}` : ""}`; }
        console.log(`Binance ${method} ${endpoint} via ${base} (attempt ${attempt + 1})`);
        const resp = await fetch(url, { method, headers });
        const data = await resp.json();
        if (!resp.ok) {
          console.error(`Binance err ${resp.status}:`, JSON.stringify(data));
          const err = new Error(`Binance API [${resp.status}]: ${JSON.stringify(data)}`);
          // 451 = geo-blocked on this host — try the next host immediately
          if (resp.status === 451) { lastErr = err; break; }
          throw err;
        }
        return data;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (lastErr.message.includes("[451]")) break; // try next host
        if (attempt < retries && (lastErr.message.includes("Connection reset") || lastErr.message.includes("os error"))) {
          console.warn(`Retrying after connection error (attempt ${attempt + 1}):`, lastErr.message);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (attempt >= retries) break; // exhausted retries on this host, try next
      }
    }
  }
  throw lastErr || new Error("All Binance hosts unreachable");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, params } = await req.json();
    console.log("action:", action);
    let result;
    switch (action) {
      case "account": result = await binanceReq("GET", "/api/v3/account", {}, true); break;
      case "balances": { const a = await binanceReq("GET", "/api/v3/account", {}, true); result = (a.balances||[]).filter((b:any)=>parseFloat(b.free)>0||parseFloat(b.locked)>0); break; }
      case "account_value": {
        const a = await binanceReq("GET", "/api/v3/account", {}, true);
        const nz = (a.balances||[]).filter((b:any)=>parseFloat(b.free)>0||parseFloat(b.locked)>0);
        const ap = await binanceReq("GET", "/api/v3/ticker/price");
        const pm:Record<string,number>={}; for(const p of ap) pm[p.symbol]=parseFloat(p.price);
        let tot=0; const h:any[]=[];
        for(const b of nz){const t=parseFloat(b.free)+parseFloat(b.locked);let u=0;
          if(["USDT","BUSD","USDC","FDUSD"].includes(b.asset))u=t;
          else if(pm[`${b.asset}USDT`])u=t*pm[`${b.asset}USDT`];
          else if(pm[`${b.asset}BTC`]&&pm["BTCUSDT"])u=t*pm[`${b.asset}BTC`]*pm["BTCUSDT"];
          h.push({asset:b.asset,free:b.free,locked:b.locked,total:t,usdValue:Math.round(u*100)/100});tot+=u;}
        h.sort((a:any,b:any)=>b.usdValue-a.usdValue);
        result={totalUsd:Math.round(tot*100)/100,holdings:h}; break;
      }
      case "all_tickers": {
        const tk=await binanceReq("GET","/api/v3/ticker/24hr");
        result=tk.filter((t:any)=>t.symbol.endsWith("USDT")&&parseFloat(t.quoteVolume)>100000)
          .map((t:any)=>({symbol:t.symbol,price:t.lastPrice,change:t.priceChangePercent,volume:t.quoteVolume,high:t.highPrice,low:t.lowPrice,trades:t.count}))
          .sort((a:any,b:any)=>parseFloat(b.volume)-parseFloat(a.volume)); break;
      }
      case "price": result=await binanceReq("GET","/api/v3/ticker/price",params||{}); break;
      case "large_trades": {
        const pairs = params?.symbols ? String(params.symbols).split(",") : ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","LINKUSDT","TRXUSDT","AVAXUSDT","LTCUSDT","DOTUSDT","NEARUSDT","SUIUSDT","PEPEUSDT"];
        const minUsd = parseFloat(params?.minUsd || "500000");
        const settled = await Promise.allSettled(
          pairs.map((sym) => binanceReq("GET", "/api/v3/aggTrades", { symbol: sym, limit: "1000" }))
        );
        const out: any[] = [];
        settled.forEach((res, i) => {
          if (res.status !== "fulfilled") return;
          const sym = pairs[i];
          for (const t of res.value as any[]) {
            const usd = parseFloat(t.p) * parseFloat(t.q);
            if (usd >= minUsd) {
              out.push({
                id: `${sym}-${t.a}`,
                symbol: sym,
                base: sym.replace(/USDT$/, ""),
                price: parseFloat(t.p),
                quantity: parseFloat(t.q),
                usd,
                side: t.m ? "SELL" : "BUY", // m=true => buyer is maker => taker sold
                time: t.T,
                aggTradeId: t.a,
                firstTradeId: t.f,
                lastTradeId: t.l,
                fillCount: (t.l - t.f) + 1,
                isBuyerMaker: !!t.m,
                exchange: "Binance Spot",
              });
            }
          }
        });
        out.sort((a, b) => b.time - a.time);
        result = out.slice(0, 40);
        break;
      }
      case "klines": {
        if(!params?.symbol) throw new Error("Missing symbol");
        result=await binanceReq("GET","/api/v3/klines",{symbol:params.symbol,interval:params.interval||"1h",limit:params.limit||"50"}); break;
      }
      case "ticker": result=await binanceReq("GET","/api/v3/ticker/24hr",params||{}); break;
      case "exchange_info": {
        const info=await binanceReq("GET","/api/v3/exchangeInfo");
        result=(info.symbols||[]).filter((s:any)=>s.status==="TRADING"&&s.quoteAsset==="USDT")
          .map((s:any)=>({symbol:s.symbol,baseAsset:s.baseAsset,minQty:s.filters?.find((f:any)=>f.filterType==="LOT_SIZE")?.minQty,stepSize:s.filters?.find((f:any)=>f.filterType==="LOT_SIZE")?.stepSize})); break;
      }
      case "order": {
        if(!params?.symbol||!params?.side||!params?.type) throw new Error("Missing order params");
        const qty=parseFloat(params.quantity||"0"),maxU=parseFloat(params.maxTradeUsd||"100");
        const pd=await binanceReq("GET","/api/v3/ticker/price",{symbol:params.symbol});
        if(qty*parseFloat(pd.price)>maxU) throw new Error(`Trade exceeds $${maxU} limit`);
        const op:Record<string,string>={symbol:params.symbol,side:params.side.toUpperCase(),type:params.type.toUpperCase()};
        if(params.quantity)op.quantity=params.quantity;if(params.quoteOrderQty)op.quoteOrderQty=params.quoteOrderQty;
        if(params.type.toUpperCase()==="LIMIT"){op.price=params.price;op.timeInForce=params.timeInForce||"GTC";}
        result=await binanceReq("POST","/api/v3/order",op,true); break;
      }
      case "test_order": {
        const tp:Record<string,string>={symbol:params.symbol,side:params.side.toUpperCase(),type:params.type.toUpperCase(),quantity:params.quantity};
        if(params.type.toUpperCase()==="LIMIT"){tp.price=params.price;tp.timeInForce=params.timeInForce||"GTC";}
        result=await binanceReq("POST","/api/v3/order/test",tp,true);
        result={...result,test:true,message:"Test order validated"}; break;
      }
      case "open_orders": result=await binanceReq("GET","/api/v3/openOrders",params||{},true); break;
      case "cancel_order": result=await binanceReq("DELETE","/api/v3/order",{symbol:params.symbol,orderId:params.orderId},true); break;
      case "trade_history": result=await binanceReq("GET","/api/v3/myTrades",{symbol:params.symbol,limit:params.limit||"20"},true); break;
      default: throw new Error(`Unknown action: ${action}`);
    }
    return new Response(JSON.stringify({success:true,data:result}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  } catch(e) {
    console.error("binance-proxy error:",e);
    return new Response(JSON.stringify({success:false,error:e instanceof Error?e.message:"Unknown"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
