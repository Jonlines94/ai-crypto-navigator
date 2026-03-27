import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BINANCE_BASE = "https://api.binance.com";

function sign(queryString: string, secret: string): string {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);
  const data = encoder.encode(queryString);
  
  // Use Web Crypto API for HMAC-SHA256
  const hmac = createHmac("sha256", key);
  hmac.update(data);
  return hmac.toString();
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
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (signed) {
    params.timestamp = Date.now().toString();
    params.recvWindow = "5000";
  }

  const queryString = new URLSearchParams(params).toString();

  let url: string;
  if (signed) {
    const signature = sign(queryString, apiSecret);
    url = `${BINANCE_BASE}${endpoint}?${queryString}&signature=${signature}`;
  } else {
    url = `${BINANCE_BASE}${endpoint}${queryString ? `?${queryString}` : ""}`;
  }

  const response = await fetch(url, { method, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Binance API error [${response.status}]: ${JSON.stringify(data)}`);
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, params } = await req.json();

    let result;
    switch (action) {
      case "account":
        result = await binanceRequest("GET", "/api/v3/account", {}, true);
        break;

      case "balances":
        const account = await binanceRequest("GET", "/api/v3/account", {}, true);
        result = account.balances?.filter(
          (b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        ) || [];
        break;

      case "ticker":
        result = await binanceRequest("GET", "/api/v3/ticker/24hr", params || {});
        break;

      case "price":
        result = await binanceRequest("GET", "/api/v3/ticker/price", params || {});
        break;

      case "order": {
        // SAFETY CHECKS
        if (!params?.symbol || !params?.side || !params?.type) {
          throw new Error("Missing required order parameters: symbol, side, type");
        }

        const quantity = parseFloat(params.quantity || "0");
        const maxTradeUsd = parseFloat(params.maxTradeUsd || "100");

        // Get current price for safety check
        const priceData = await binanceRequest("GET", "/api/v3/ticker/price", { symbol: params.symbol });
        const currentPrice = parseFloat(priceData.price);
        const orderValueUsd = quantity * currentPrice;

        if (orderValueUsd > maxTradeUsd) {
          throw new Error(
            `Trade value $${orderValueUsd.toFixed(2)} exceeds max limit of $${maxTradeUsd}. Reduce quantity or increase limit.`
          );
        }

        // Execute the order
        const orderParams: Record<string, string> = {
          symbol: params.symbol,
          side: params.side.toUpperCase(),
          type: params.type.toUpperCase(),
          quantity: params.quantity,
        };

        if (params.type === "LIMIT") {
          orderParams.price = params.price;
          orderParams.timeInForce = params.timeInForce || "GTC";
        }

        result = await binanceRequest("POST", "/api/v3/order", orderParams, true);
        break;
      }

      case "test_order": {
        // Test order (no real execution)
        const testParams: Record<string, string> = {
          symbol: params.symbol,
          side: params.side.toUpperCase(),
          type: params.type.toUpperCase(),
          quantity: params.quantity,
        };

        if (params.type === "LIMIT") {
          testParams.price = params.price;
          testParams.timeInForce = params.timeInForce || "GTC";
        }

        result = await binanceRequest("POST", "/api/v3/order/test", testParams, true);
        result = { ...result, test: true, message: "Test order validated successfully" };
        break;
      }

      case "open_orders":
        result = await binanceRequest("GET", "/api/v3/openOrders", params || {}, true);
        break;

      case "cancel_order":
        result = await binanceRequest("DELETE", "/api/v3/order", {
          symbol: params.symbol,
          orderId: params.orderId,
        }, true);
        break;

      case "trade_history":
        result = await binanceRequest("GET", "/api/v3/myTrades", {
          symbol: params.symbol,
          limit: params.limit || "20",
        }, true);
        break;

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
