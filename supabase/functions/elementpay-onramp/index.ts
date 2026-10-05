// Element Pay Partner API — Buy (OnRamp).
// Docs: https://partners.elementpay.net  (base: https://api.elementpay.net/api/v1)
//
// IMPORTANT: this function is intentionally SELF-CONTAINED (no relative
// imports). The deployment pipeline for this project uploads only index.ts,
// so any sibling/shared module import fails at bundle time
// ("Module not found .../source/elementpay.ts"). Keep it that way.
//
// Order creation is TWO steps:
//   1. POST /partner/orders/quote             -> { quote_id, ... }
//   2. POST /partner/orders/{quote_id}/accept  -> final order
// The accept schema has additionalProperties:false and only allows
// { provider?, payment_method? } — send an EMPTY object. Sending
// { reference } was rejected upstream with "Validation error".
// Auth is the `X-API-Key` header only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const isEvmAddress = (v: unknown): v is string =>
  typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);

/** Element Pay expects E.164 with a leading `+` (e.g. +2547XXXXXXXX). */
function toE164(raw: unknown, defaultCountryCode = "254"): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = defaultCountryCode + digits.slice(1);
  if (!digits.startsWith(defaultCountryCode) && digits.length <= 10) {
    digits = defaultCountryCode + digits;
  }
  return `+${digits}`;
}

/** Internal network id -> Element Pay `asset.network` value. */
const NETWORK_MAP: Record<string, string> = {
  base: "BASE",
  scroll: "SCROLL",
  polygon: "POLYGON",
  "bnb-smart-chain": "BNB",
  bsc: "BNB",
  lisk: "LISK",
  celo: "CELO",
  arbitrum: "ARBITRUM",
  optimism: "OPTIMISM",
  ethereum: "ETHEREUM",
};

const toEpNetwork = (network: unknown): string =>
  NETWORK_MAP[String(network ?? "base").toLowerCase()] ?? String(network ?? "BASE").toUpperCase();

/** Known stablecoin contracts so we can derive `asset.currency` (the symbol). */
const TOKEN_SYMBOLS: Record<string, string> = {
  // Base
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": "USDT",
  // Polygon
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "USDT",
  // Scroll
  "0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4": "USDC",
  "0xf55bec9cafdbe8730f096aa55dad6d22d44099df": "USDT",
  // BNB Smart Chain
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
};

function tokenSymbolFor(tokenAddress: unknown, fallback?: unknown): string {
  if (typeof fallback === "string" && /^[A-Za-z0-9]{2,10}$/.test(fallback)) {
    return fallback.toUpperCase();
  }
  if (typeof tokenAddress === "string") {
    const hit = TOKEN_SYMBOLS[tokenAddress.toLowerCase()];
    if (hit) return hit;
  }
  return "USDC";
}

/** Pull a readable, field-level error out of a partner API error body. */
function formatProviderError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const root = payload as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof root.message === "string" && root.message) parts.push(root.message);
  if (typeof root.error === "string" && root.error && root.error !== root.message) parts.push(root.error);

  const data = root.data;
  if (typeof data === "string" && data) {
    parts.push(data);
  } else if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.field === "string") parts.push(`field: ${d.field}`);
    if (Array.isArray(d.missing_fields) && d.missing_fields.length) {
      parts.push(`missing: ${d.missing_fields.join(", ")}`);
    }
    if (typeof d.reason === "string") parts.push(d.reason);
    if (!parts.length) parts.push(JSON.stringify(d));
  }

  const details = root.details ?? root.errors;
  if (Array.isArray(details) && details.length) {
    parts.push(details.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; "));
  } else if (details && typeof details === "object") {
    parts.push(JSON.stringify(details));
  }

  return parts.length ? parts.join(" — ") : fallback;
}

interface EpResponse {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
  raw: string;
}

async function epFetch(
  path: string,
  apiKey: string,
  init: { method?: string; body?: unknown } = {},
): Promise<EpResponse> {
  const res = await fetch(`${ELEMENTPAY_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const raw = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    body = { message: raw.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, body, raw };
}

// ---------------------------------------------------------------------------
// Catalog: resolves the `network_id` required by payment_method blocks.
// ---------------------------------------------------------------------------

let catalogCache: { at: number; value: unknown } | null = null;
const CATALOG_TTL_MS = 10 * 60 * 1000;

async function getCatalog(apiKey: string): Promise<unknown> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.value;
  const res = await epFetch("/partner/catalog", apiKey);
  if (!res.ok) {
    console.warn("[elementpay] catalog fetch failed", res.status, res.raw.slice(0, 300));
    return null;
  }
  catalogCache = { at: Date.now(), value: res.body };
  return res.body;
}

// ---------------------------------------------------------------------------
// Amount limits — catalog first, operator fallback second.
// ---------------------------------------------------------------------------

const FALLBACK_BUY_LIMITS = { min: 10, max: 450000 };

const MIN_KEYS = ["min_amount", "minimum_amount", "min_local_amount", "min", "minimum", "min_order_amount"];
const MAX_KEYS = ["max_amount", "maximum_amount", "max_local_amount", "max", "maximum", "max_order_amount"];

const positiveNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    const n = Number(value);
    return n > 0 ? n : null;
  }
  return null;
};

function pickLimit(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const hit = positiveNumber(obj[key]);
    if (hit !== null) return hit;
  }
  return null;
}

/** Locate on-ramp (KES) min/max in the catalog; null when not published. */
function extractOnrampLimits(catalog: unknown): { min: number; max: number } | null {
  let found: { min: number; max: number } | null = null;

  const visit = (node: unknown, inheritedHint: string) => {
    if (found || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inheritedHint);
      return;
    }
    const obj = node as Record<string, unknown>;
    const hint = [inheritedHint, obj.order_type, obj.direction, obj.type, obj.rail, obj.currency]
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();

    const min = pickLimit(obj, MIN_KEYS);
    const max = pickLimit(obj, MAX_KEYS);
    const isOff = /offramp|off_ramp|off-ramp|sell|withdraw/.test(hint);
    // Only trust a node that is explicitly the KES on-ramp rail. Generic nodes
    // (fees, provider caps, unrelated corridors) previously matched first and
    // produced limits the UI never showed, e.g. KES 150–10,000.
    const isOnRampKes = /onramp|on_ramp|on-ramp|buy|deposit|kes|mpesa|m-pesa/.test(hint);
    if (min !== null && max !== null && max > min && !isOff && isOnRampKes) {
      found = { min, max };
      return;
    }
    for (const value of Object.values(obj)) visit(value, hint);
  };

  visit(catalog, "");
  return found;
}

async function resolveBuyLimits(apiKey: string): Promise<{ min: number; max: number }> {
  try {
    const catalog = await getCatalog(apiKey);
    return extractOnrampLimits(catalog) ?? FALLBACK_BUY_LIMITS;
  } catch {
    return FALLBACK_BUY_LIMITS;
  }
}

/** Well-known M-PESA (Kenya mobile money) provider id from the partner catalog. */
const MPESA_NETWORK_ID = "7ea6df5c-6bba-46b2-a7e6-f511959e7edb";

/**
 * Walk the catalog looking for the mobile-money provider id matching `hint`
 * (defaults to M-PESA). Falls back to the documented M-PESA id.
 */
async function resolveMobileMoneyNetworkId(
  apiKey: string,
  hint = "mpesa",
  country = "KE",
): Promise<string> {
  const catalog = await getCatalog(apiKey);
  const normalizedHint = hint.replace(/[^a-z]/gi, "").toLowerCase();
  let found: string | null = null;

  const visit = (node: unknown) => {
    if (found || !node) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const id =
      (typeof obj.network_id === "string" && obj.network_id) ||
      (typeof obj.id === "string" && obj.id) ||
      null;
    const label = [obj.name, obj.code, obj.provider, obj.slug]
      .filter((v) => typeof v === "string")
      .join(" ")
      .replace(/[^a-z]/gi, "")
      .toLowerCase();
    const countryOk =
      typeof obj.country !== "string" || obj.country.toUpperCase() === country.toUpperCase();
    if (id && label.includes(normalizedHint) && countryOk) {
      found = id;
      return;
    }
    for (const value of Object.values(obj)) visit(value);
  };

  visit(catalog);
  return found ?? MPESA_NETWORK_ID;
}

// ---------------------------------------------------------------------------
// Response parsing helpers
// ---------------------------------------------------------------------------

function extractQuoteId(body: Record<string, unknown>): string | null {
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
  for (const key of ["quote_id", "quoteId", "id", "order_id"]) {
    const value = data[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function extractOrderData(body: Record<string, unknown>): Record<string, unknown> {
  const data = body.data;
  if (!data || typeof data !== "object") return body;
  const d = data as Record<string, unknown>;
  // Accept responses nest the order under data.order
  const order = d.order;
  if (order && typeof order === "object") {
    return { ...d, ...(order as Record<string, unknown>) };
  }
  return d;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEMENTPAY_API_KEY");
    if (!apiKey) {
      return json({ status: "error", error: "Element Pay API key not configured", code: "CONFIG_ERROR" }, 500);
    }

    const body = await req.json();
    const {
      amountFiat,
      phoneNumber,
      walletAddress,
      token,
      tokenSymbol,
      network,
      clientRef,
      customerName,
      customerEmail,
    } = body;

    const buyLimits = await resolveBuyLimits(apiKey);
    const requestedFiat = Number(amountFiat);
    if (!requestedFiat || !Number.isFinite(requestedFiat) || requestedFiat < buyLimits.min || requestedFiat > buyLimits.max) {
      return json({
        status: "error",
        error: `Amount must be between KES ${buyLimits.min.toLocaleString()} and KES ${buyLimits.max.toLocaleString()}.`,
        code: "AMOUNT_OUT_OF_RANGE",
        debug: { limits: buyLimits },
      }, 400);
    }
    const msisdn = toE164(phoneNumber);
    if (!msisdn || !/^\+254[17]\d{8}$/.test(msisdn)) {
      return json({ status: "error", error: "Invalid phone number" }, 400);
    }
    if (!isEvmAddress(walletAddress)) {
      return json({ status: "error", error: "Enter a valid EVM wallet address" }, 400);
    }
    if (!isEvmAddress(token)) {
      return json({ status: "error", error: "Select a valid supported token" }, 400);
    }

    const reference = typeof clientRef === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(clientRef)
      ? clientRef
      : `NYT-BUY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const networkId = await resolveMobileMoneyNetworkId(apiKey, "mpesa", "KE");

    // Step 1 — quote
    const quotePayload = {
      order_type: "OnRamp",
      currency: "KES",
      country: "KE",
      local_amount: Math.round(Number(amountFiat)),
      asset: {
        token,
        currency: tokenSymbolFor(token, tokenSymbol),
        network: toEpNetwork(network),
      },
      customer: {
        uid: reference,
        type: "user",
        name: typeof customerName === "string" && customerName ? customerName : "Nyati Customer",
        phone: msisdn,
        email: typeof customerEmail === "string" ? customerEmail : "",
        country: "KE",
        // KE corridor requires the full retail KYC block.
        address: typeof body.customerAddress === "string" && body.customerAddress ? body.customerAddress : "Nairobi",
        dob: typeof body.customerDob === "string" ? body.customerDob : "",
        id_number: typeof body.customerIdNumber === "string" ? body.customerIdNumber : "",
        id_type: typeof body.customerIdType === "string" && body.customerIdType ? body.customerIdType : "national_id",
      },

      payment_method: {
        type: "mobile_money",
        phone_number: msisdn,
        network_id: networkId,
      },
      wallet_address: walletAddress,
      reference,
    };

    console.log("[elementpay-onramp] quote", JSON.stringify(quotePayload));
    const quoteRes = await epFetch("/partner/orders/quote", apiKey, {
      method: "POST",
      body: quotePayload,
    });
    console.log("[elementpay-onramp] quote response", quoteRes.status, quoteRes.raw.slice(0, 1200));

    if (!quoteRes.ok) {
      const isServerError = quoteRes.status >= 500;
      return json({
        status: "error",
        error: formatProviderError(quoteRes.body, "Failed to quote buy order"),
        code: isServerError ? "PROVIDER_UNAVAILABLE" : "QUOTE_FAILED",
        fallback: isServerError,
        debug: { providerStatus: quoteRes.status, sent: quotePayload, raw: quoteRes.body },
      });
    }

    const quoteId = extractQuoteId(quoteRes.body);
    if (!quoteId) {
      return json({
        status: "error",
        error: "Element Pay did not return a quote id",
        code: "QUOTE_FAILED",
        debug: { raw: quoteRes.body },
      });
    }

    // Step 2 — accept. The accept schema (additionalProperties:false) only
    // allows { provider?, payment_method? }; an EMPTY object is the documented
    // call for local fiat rail. Do NOT send `reference` here — Element Pay
    // rejects it with "Validation error".
    const acceptRes = await epFetch(`/partner/orders/${encodeURIComponent(quoteId)}/accept`, apiKey, {
      method: "POST",
      body: {},
    });
    console.log("[elementpay-onramp] accept response", acceptRes.status, acceptRes.raw.slice(0, 1200));

    if (!acceptRes.ok) {
      const isServerError = acceptRes.status >= 500;
      return json({
        status: "error",
        error: formatProviderError(acceptRes.body, "Failed to create buy order"),
        code: isServerError ? "PROVIDER_UNAVAILABLE" : "ORDER_CREATE_FAILED",
        fallback: isServerError,
        debug: { providerStatus: acceptRes.status, quoteId, raw: acceptRes.body },
      });
    }

    const quoteData = extractOrderData(quoteRes.body);
    const orderData = extractOrderData(acceptRes.body);

    const orderId =
      pickString(orderData, ["order_id", "id", "tx_hash", "transaction_hash", "psp_transaction_id"]) ?? quoteId;
    const rateUsed =
      pickNumber(orderData, ["exchange_rate", "rate", "rate_used"]) ??
      pickNumber(quoteData, ["exchange_rate", "rate", "rate_used"]) ??
      0;
    const amountSent =
      pickNumber(orderData, ["amount_crypto", "crypto_amount", "amount_sent", "asset_amount"]) ??
      pickNumber(quoteData, ["amount_crypto", "crypto_amount", "amount_sent", "asset_amount"]) ??
      0;
    const fiatPaid =
      pickNumber(orderData, ["amount_fiat", "local_amount", "fiat_paid"]) ?? Number(amountFiat);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("transactions").insert({
      reference,
      paycrest_order_id: orderId,
      phone_number: msisdn,
      recipient_name: walletAddress,
      institution: "MPESA",
      amount_usdt: amountSent,
      amount_kes: Number(amountFiat),
      rate_used: rateUsed,
      nyati_fee_percent: 0,
      network: network || "base",
      receive_address: walletAddress,
      sender_fee: 0,
      transaction_fee: 0,
      status: "pending",
      provider: "elementpay",
      order_type: "onramp",
      cashout_type: "PHONE",
    });

    return json({
      status: "success",
      data: {
        reference,
        txHash: orderId,
        quoteId,
        status: pickString(orderData, ["status", "state"]) ?? "pending",
        rateUsed,
        amountSent,
        fiatPaid,
        sandbox: false,
        environment: "production",
      },
    });
  } catch (error) {
    console.error("[elementpay-onramp] Unexpected error:", error);
    return json({
      status: "error",
      error: error instanceof Error ? error.message : "Unexpected error",
      code: "UNEXPECTED_ERROR",
      fallback: true,
    });
  }
});
