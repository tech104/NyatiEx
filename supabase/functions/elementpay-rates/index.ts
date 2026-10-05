import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NYATI_FEE_PERCENT = 1.5; // Nyati spread/fee

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const amount = parseFloat(url.searchParams.get("amount") || "0");
    const token = url.searchParams.get("token") || "USDC";
    const currency = url.searchParams.get("currency") || "KES";

    if (!amount || amount < 0.5) {
      return json({ status: "error", error: "Amount must be at least 0.5" }, 400);
    }

    // Fetch USDC/KES rate from CoinGecko (free, no API key needed)
    let marketRate = 129; // fallback rate
    try {
      const cgRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=kes",
        { headers: { "Accept": "application/json" } }
      );
      if (cgRes.ok) {
        const cgData = await cgRes.json();
        if (cgData?.["usd-coin"]?.kes) {
          marketRate = cgData["usd-coin"].kes;
        }
      }
    } catch (e) {
      console.warn("[elementpay-rates] CoinGecko fetch failed, using fallback rate:", e);
    }

    const feePercent = NYATI_FEE_PERCENT;
    const effectiveRate = marketRate * (1 - feePercent / 100);

    return json({
      status: "success",
      data: {
        marketRate,
        effectiveRate,
        feePercent,
        token,
        currency,
        amount,
        estimatedPayout: amount * effectiveRate,
      },
    });
  } catch (error) {
    console.error("[elementpay-rates] Unexpected error:", error);
    return json({
      status: "error",
      error: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
});
