// Element Pay — buy/sell amount limits.
//
// Reads the partner catalog and extracts per-rail minimum/maximum amounts.
// Falls back to the operator-configured limits when the catalog does not
// publish them.
//
// IMPORTANT: self-contained (no relative imports) — the deploy pipeline
// uploads only index.ts.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ELEMENTPAY_BASE = "https://api.elementpay.net/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Operator fallbacks (used when the catalog exposes no limits).
export const FALLBACK_LIMITS = {
  buy: { min: 10, max: 450000, currency: "KES" },
  sell: { min: 1, max: 4000, currency: "USD" },
};

interface Limit {
  min: number;
  max: number;
  currency: string;
}

let cache: { at: number; value: unknown } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getCatalog(apiKey: string): Promise<unknown> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  try {
    const res = await fetch(`${ELEMENTPAY_BASE}/partner/catalog`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn("[elementpay-limits] catalog fetch failed", res.status);
      return null;
    }
    const body = await res.json();
    cache = { at: Date.now(), value: body };
    return body;
  } catch (err) {
    console.warn("[elementpay-limits] catalog error", err);
    return null;
  }
}

const MIN_KEYS = [
  "min_amount",
  "minimum_amount",
  "min_local_amount",
  "min",
  "minimum",
  "min_order_amount",
];
const MAX_KEYS = [
  "max_amount",
  "maximum_amount",
  "max_local_amount",
  "max",
  "maximum",
  "max_order_amount",
];

const numberFrom = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    const n = Number(value);
    return n > 0 ? n : null;
  }
  return null;
};

function pick(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const hit = numberFrom(obj[key]);
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * Walk the catalog collecting nodes that carry both a min and a max, and
 * classify each as on-ramp (fiat/KES) or off-ramp (crypto) using nearby
 * hints (order_type, currency, direction).
 */
function extractLimits(catalog: unknown): { buy: Limit | null; sell: Limit | null } {
  let buy: Limit | null = null;
  let sell: Limit | null = null;

  const visit = (node: unknown, inheritedHint: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inheritedHint);
      return;
    }
    const obj = node as Record<string, unknown>;

    const hint = [
      inheritedHint,
      obj.order_type,
      obj.direction,
      obj.type,
      obj.rail,
      obj.name,
      obj.currency,
      obj.asset_currency,
    ]
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();

    const min = pick(obj, MIN_KEYS);
    const max = pick(obj, MAX_KEYS);

    if (min !== null && max !== null && max > min) {
      const isOff = /offramp|off_ramp|off-ramp|sell|withdraw/.test(hint);
      const isOn = /onramp|on_ramp|on-ramp|buy|deposit/.test(hint);
      const currency =
        typeof obj.currency === "string" && obj.currency
          ? obj.currency.toUpperCase()
          : isOff
            ? "USD"
            : "KES";

      if (isOff && !sell) sell = { min, max, currency };
      else if (isOn && !buy) buy = { min, max, currency };
      else if (!isOff && !isOn && currency === "KES" && !buy) buy = { min, max, currency };
    }

    for (const value of Object.values(obj)) visit(value, hint);
  };

  visit(catalog, "");
  return { buy, sell };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ELEMENTPAY_API_KEY");
  if (!apiKey) {
    return json({
      status: "success",
      data: { ...FALLBACK_LIMITS, source: "fallback" },
    });
  }

  const catalog = await getCatalog(apiKey);
  const extracted = catalog ? extractLimits(catalog) : { buy: null, sell: null };

  const buy = extracted.buy ?? FALLBACK_LIMITS.buy;
  const sell = extracted.sell ?? FALLBACK_LIMITS.sell;
  const source = extracted.buy || extracted.sell ? "catalog" : "fallback";

  return json({
    status: "success",
    data: { buy, sell, source },
  });
});
