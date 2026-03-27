import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BINANCE_BASE = "https://api.binance.com";

async function hmacSign(queryString: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(queryString));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function binanceRequest(
  method: string,
  endpoint: string,
  params: Record<string, string> = {},
  signed = false
) {
  const apiKey = Deno.env.get("BINANCE_API_KEY");
  const apiSecret = Deno.env.get("BINANCE_API_SECRET");

  if (!apiKey || !apiSecret) throw new Error("Binance API keys not configured");

  const headers: Record<string, string> = {
    "X-MBX-APIKEY": apiKey,
  };

  if (signed) {
    params.timestamp = Date.now().toString();
    params.recvWindow = "10000";
  }

  const queryString = new URLSearchParams(params).toString();

  let url: string;
  if (signed) {
    const signature = await hmacSign(queryString, apiSecret);
    url = `${BINANCE_BASE}${endpoint}?${queryString}&signature=${signature}`;
  } else {
    url = `${BINANCE_BASE}${endpoint}${queryString ? `?${queryString}` : ""}`;
  }

  console.log(`Binance ${method} ${endpoint} signed=${signed}`);

  const response = await fetch(url, { method, headers });
  const data = await response.json();

  if (!response.ok) {
    console.error(`Binance error: ${response.status}`, JSON.stringify(data));
    throw new Error(`Binance API error [${response.status}]: ${JSON.stringify(data)}`);
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, params } = await req.json();
    console.log("binance-proxy action:", action);

    let result;
    switch (action) {
      case "account": {
        result = await binanceRequest("GET", "/api/v3/account", {}, true);
        break;
      }

      case "balances": {
        const acct = await binanceRequest("GET", "/api/v3/account", {}, true);
        result = (acct.balances || []).filter(
          (b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        );
        break;
      }

      case "account_value": {
        // Get balances + prices to calculate total USD value
        const acct2 = await binanceRequest("GET", "/api/v3/account", {}, true);
        const nonZero = (acct2.balances || []).filter(
          (b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        );

        // Get all prices
        const allPrices = await binanceRequest("GET", "/api/v3/ticker/price");
        const priceMap: Record<string, number> = {};
        for (const p of allPrices) {
          priceMap[p.symbol] = parseFloat(p.price);
        }

        let totalUsd = 0;
        const holdings = [];
        for (const b of nonZero) {
          const total = parseFloat(b.free) + parseFloat(b.locked);
          let usdValue = 0;

          if (b.asset === "USDT" || b.asset === "BUSD" || b.asset === "USDC" || b.asset === "FDUSD") {
            usdValue = total;
          } else if (priceMap[`${b.asset}USDT`]) {
            usdValue = total * priceMap[`${b.asset}USDT`];
          } else if (priceMap[`${b.asset}BUSD`]) {
            usdValue = total * priceMap[`${b.asset}BUSD`];
          } else if (priceMap[`${b.asset}BTC`] && priceMap["BTCUSDT"]) {
            usdValue = total * priceMap[`${b.asset}BTC`] * priceMap["BTCUSDT"];
          }

          holdings.push({
            asset: b.asset,
            free: b.free,
            locked: b.locked,
            total,
            usdValue: Math.round(usdValue * 100) / 100,
          });
          totalUsd += usdValue;
        }

        holdings.sort((a: any, b: any) => b.usdValue - a.usdValue);
        result = { totalUsd: Math.round(totalUsd * 100) / 100, holdings };
        break;
      }

      case "ticker": {
        result = await binanceRequest("GET", "/api/v3/ticker/24hr", params || {});
        break;
      }

      case "all_tickers": {
        // Get all trading pairs with 24h data
        const tickers = await binanceRequest("GET", "/api/v3/ticker/24hr");
        // Filter for USDT pairs with meaningful volume
        result = tickers
          .filter((t: any) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 100000)
          .map((t: any) => ({
            symbol: t.symbol,
            price: t.lastPrice,
            change: t.priceChangePercent,
            volume: t.quoteVolume,
            high: t.highPrice,
            low: t.lowPrice,
            trades: t.count,
          }))
          .sort((a: any, b: any) => parseFloat(b.volume) - parseFloat(a.volume));
        break;
      }

      case "price": {
        result = await binanceRequest("GET", "/api/v3/ticker/price", params || {});
        break;
      }

      case "exchange_info": {
        // Get all tradeable symbols
        const info = await binanceRequest("GET", "/api/v3/exchangeInfo");
        result = info.symbols
          ?.filter((s: any) => s.status === "TRADING" && s.quoteAsset === "USDT")
          .map((s: any) => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            minQty: s.filters?.find((f: any) => f.filterType === "LOT_SIZE")?.minQty,
            stepSize: s.filters?.find((f: any) => f.filterType === "LOT_SIZE")?.stepSize,
            minNotional: s.filters?.find((f: any) => f.filterType === "NOTIONAL")?.minNotional ||
              s.filters?.find((f: any) => f.filterType === "MIN_NOTIONAL")?.minNotional,
          })) || [];
        break;
      }

      case "order": {
        if (!params?.symbol || !params?.side || !params?.type) {
          throw new Error("Missing required order parameters: symbol, side, type");
        }

        const quantity = parseFloat(params.quantity || "0");
        const maxTradeUsd = parseFloat(params.maxTradeUsd || "100");

        const priceData = await binanceRequest("GET", "/api/v3/ticker/price", { symbol: params.symbol });
        const currentPrice = parseFloat(priceData.price);
        const orderValueUsd = quantity * currentPrice;

        if (orderValueUsd > maxTradeUsd) {
          throw new Error(
            `Trade value $${orderValueUsd.toFixed(2)} exceeds max limit of $${maxTradeUsd}. Reduce quantity or increase limit.`
          );
        }

        const orderParams: Record<string, string> = {
          symbol: params.symbol,
          side: params.side.toUpperCase(),
          type: params.type.toUpperCase(),
          quantity: params.quantity,
        };

        if (params.type.toUpperCase() === "LIMIT") {
          orderParams.price = params.price;
          orderParams.timeInForce = params.timeInForce || "GTC";
        }

        if (params.type.toUpperCase() === "MARKET" && !params.quantity && params.quoteOrderQty) {
          delete orderParams.quantity;
          orderParams.quoteOrderQty = params.quoteOrderQty;
        }

        result = await binanceRequest("POST", "/api/v3/order", orderParams, true);
        break;
      }

      case "test_order": {
        const testParams: Record<string, string> = {
          symbol: params.symbol,
          side: params.side.toUpperCase(),
          type: params.type.toUpperCase(),
          quantity: params.quantity,
        };

        if (params.type.toUpperCase() === "LIMIT") {
          testParams.price = params.price;
          testParams.timeInForce = params.timeInForce || "GTC";
        }

        result = await binanceRequest("POST", "/api/v3/order/test", testParams, true);
        result = { ...result, test: true, message: "Test order validated successfully" };
        break;
      }

      case "open_orders": {
        result = await binanceRequest("GET", "/api/v3/openOrders", params || {}, true);
        break;
      }

      case "cancel_order": {
        result = await binanceRequest("DELETE", "/api/v3/order", {
          symbol: params.symbol,
          orderId: params.orderId,
        }, true);
        break;
      }

      case "trade_history": {
        result = await binanceRequest("GET", "/api/v3/myTrades", {
          symbol: params.symbol,
          limit: params.limit || "20",
        }, true);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("binance-proxy error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
