import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const amount = url.searchParams.get("amount") || "100";
    const network = url.searchParams.get("network") || "base";
    const token = url.searchParams.get("token") || "USDT";
    const currency = url.searchParams.get("currency") || "KES";

    // Fetch rate from Paycrest (public endpoint, no API key needed)
    const rateRes = await fetch(
      `https://api.paycrest.io/v1/rates/${token}/${amount}/${currency}?network=${network}`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (!rateRes.ok) {
      const errText = await rateRes.text();
      console.error(`Paycrest rate fetch failed: ${errText}`);

      // Try to fall back to cached rate
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: cached } = await supabase
        .from("exchange_rates")
        .select("rate, updated_at")
        .eq("token", token)
        .eq("currency", currency)
        .eq("network", network)
        .single();

      if (cached) {
        const nyatiFeePercent = parseFloat(Deno.env.get("NYATI_FEE_PERCENT") || "1.5");
        return new Response(
          JSON.stringify({
            status: "success",
            data: {
              paycrestRate: cached.rate / (1 - nyatiFeePercent / 100),
              nyatiRate: cached.rate,
              nyatiFeePercent,
              token,
              currency,
              network,
              amount: parseFloat(amount),
              cached: true,
              cachedAt: cached.updated_at,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try fetching rate with amount=1 as fallback
      try {
        const fallbackRes = await fetch(
          `https://api.paycrest.io/v1/rates/${token}/1/${currency}?network=${network}`,
          { headers: { "Content-Type": "application/json" } }
        );
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const fallbackRate = parseFloat(fallbackData.data);
          const nyatiFeePercent = parseFloat(Deno.env.get("NYATI_FEE_PERCENT") || "1.5");
          const nyatiRate = fallbackRate * (1 - nyatiFeePercent / 100);
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                paycrestRate: fallbackRate,
                nyatiRate: Math.round(nyatiRate * 100) / 100,
                nyatiFeePercent,
                token,
                currency,
                network,
                amount: parseFloat(amount),
                cached: false,
                fallback: true,
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.error("Fallback rate fetch also failed:", e);
      }

      return new Response(
        JSON.stringify({ status: "error", error: "No provider available", fallback: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rateData = await rateRes.json();
    const paycrestRate = parseFloat(rateData.data);

    // Get Nyati fee percentage from env or default
    const nyatiFeePercent = parseFloat(Deno.env.get("NYATI_FEE_PERCENT") || "1.5");

    // Nyati adjusts the rate by subtracting fee (user gets slightly less KES per USDT)
    const nyatiRate = paycrestRate * (1 - nyatiFeePercent / 100);

    // Cache in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("exchange_rates")
      .upsert(
        { token, currency, network, rate: nyatiRate, updated_at: new Date().toISOString() },
        { onConflict: "token,currency,network" }
      );

    return new Response(
      JSON.stringify({
        status: "success",
        data: {
          paycrestRate,
          nyatiRate: Math.round(nyatiRate * 100) / 100,
          nyatiFeePercent,
          token,
          currency,
          network,
          amount: parseFloat(amount),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
