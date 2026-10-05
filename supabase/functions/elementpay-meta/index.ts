import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ELEMENTPAY_BASE = "https://api.elementpay.net/api/v1";

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
    const apiKey = Deno.env.get("ELEMENTPAY_API_KEY");
    if (!apiKey) {
      return json({ status: "error", error: "Element Pay API key not configured", code: "CONFIG_ERROR" }, 500);
    }

    const res = await fetch(`${ELEMENTPAY_BASE}/meta/tokens?env=live`, {
      headers: { "X-API-Key": apiKey },
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[elementpay-meta] Non-JSON response:", res.status, text);
      return json({
        status: "error",
        error: "Element Pay returned an unexpected response",
        code: "PROVIDER_ERROR",
        fallback: true,
      });
    }

    if (!res.ok) {
      console.error("[elementpay-meta] API error:", res.status, text);
      const isServerError = res.status >= 500;
      return json({
        status: "error",
        error: isServerError ? "Element Pay service is temporarily unavailable" : "Failed to fetch tokens",
        code: isServerError ? "PROVIDER_UNAVAILABLE" : "TOKEN_FETCH_FAILED",
        fallback: isServerError,
      });
    }

    return json(data);
  } catch (error) {
    console.error("[elementpay-meta] Unexpected error:", error);
    return json({
      status: "error",
      error: error instanceof Error ? error.message : "Unexpected error",
      code: "UNEXPECTED_ERROR",
      fallback: true,
    });
  }
});
