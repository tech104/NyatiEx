// Element Pay Partner API — Sell (OffRamp).
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
// { reference, approval_tx_hash } was rejected upstream with "Validation error".
// Auth is the `X-API-Key` header only.
//
// SETTLEMENT MODEL (verified live 2026-09-04): Element Pay off-ramp does NOT
// pull funds with `transferFrom`. Each accepted order carries its own deposit
// wallet (`data.order.wallet_address`) and stays `processing` with
// `creation_transaction_hash: null` until the exact token amount is SENT there.
// So the flow is: create order -> return deposit address -> wallet does ONE
// ERC-20 `transfer` -> client posts the hash back with `action: "settlement"`,
// which we verify on-chain (Transfer log: owner -> deposit address, exact
// amount) before binding it to the order. The `approval_tx_hash` column now
// stores that settlement transfer hash (kept for schema compatibility) and
// still gives us single-use replay protection.

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

/** Decimals for the whitelisted stablecoins (BNB Chain pegs use 18). */
const TOKEN_DECIMALS: Record<string, number> = {
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": 18,
  "0x55d398326f99059ff775485246999027b3197955": 18,
};

const decimalsFor = (tokenAddress: string): number =>
  TOKEN_DECIMALS[tokenAddress.toLowerCase()] ?? 6;

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

/** Well-known M-PESA (Kenya mobile money) provider id from the partner catalog. */
const MPESA_NETWORK_ID = "7ea6df5c-6bba-46b2-a7e6-f511959e7edb";

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
// Amount limits — catalog first, operator fallback second.
// ---------------------------------------------------------------------------

const FALLBACK_SELL_LIMITS = { min: 1, max: 4000 };

const MIN_KEYS = ["min_amount", "minimum_amount", "min_crypto_amount", "min", "minimum", "min_order_amount"];
const MAX_KEYS = ["max_amount", "maximum_amount", "max_crypto_amount", "max", "maximum", "max_order_amount"];

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

/** Locate off-ramp (crypto) min/max in the catalog; null when not published. */
function extractOfframpLimits(catalog: unknown): { min: number; max: number } | null {
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
    if (min !== null && max !== null && max > min && isOff) {
      found = { min, max };
      return;
    }
    for (const value of Object.values(obj)) visit(value, hint);
  };

  visit(catalog, "");
  return found;
}

async function resolveSellLimits(apiKey: string): Promise<{ min: number; max: number }> {
  try {
    const catalog = await getCatalog(apiKey);
    return extractOfframpLimits(catalog) ?? FALLBACK_SELL_LIMITS;
  } catch {
    return FALLBACK_SELL_LIMITS;
  }
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
// On-chain approval verification
// ---------------------------------------------------------------------------

// Fallback token (USDC on Base Mainnet) when client doesn't supply one
const DEFAULT_TOKEN_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Networks we can verify settlement transfers on.
const SUPPORTED_SELL_NETWORKS = ["base", "scroll", "polygon", "bnb-smart-chain"];

// Public RPCs used to verify the approval transaction on-chain. We deliberately
// don't trust the wallet — we re-fetch the receipt from a known RPC.
const RPC_BY_NETWORK: Record<string, string[]> = {
  base: ["https://base.llamarpc.com", "https://base-rpc.publicnode.com", "https://mainnet.base.org"],
  scroll: ["https://scroll-rpc.publicnode.com", "https://rpc.scroll.io"],
  polygon: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"],
  "bnb-smart-chain": ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org"],
};

const isAddress = (v: unknown): v is string =>
  typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);

const isTxHash = (v: unknown): v is string =>
  typeof v === "string" && /^0x[a-fA-F0-9]{64}$/.test(v);

const eqAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const padToTopic = (address: string) =>
  ("0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0")).toLowerCase();

const hexToBigInt = (hex: string): bigint => {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
};

type RpcLog = { address: string; topics: string[]; data: string };
type RpcReceipt = {
  status: string;
  from: string;
  to: string | null;
  logs: RpcLog[];
  blockNumber: string;
};

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message ?? "error"}`);
  return body.result as T;
}

async function getReceipt(network: string, txHash: string): Promise<RpcReceipt | null> {
  const urls = RPC_BY_NETWORK[network] ?? [];
  let lastErr: unknown = null;
  // Relayed / smart-account transactions can land a few seconds late, so retry
  // the whole RPC list a couple of times before giving up.
  for (let round = 0; round < 3; round += 1) {
    for (const url of urls) {
      try {
        const receipt = await rpcCall<RpcReceipt | null>(url, "eth_getTransactionReceipt", [txHash]);
        if (receipt) return receipt;
      } catch (err) {
        lastErr = err;
      }
    }
    if (round < 2) await new Promise((r) => setTimeout(r, 2000));
  }
  if (lastErr) console.warn("[elementpay-offramp] All RPCs failed for receipt:", lastErr);
  return null;
}

/**
 * Verify that `txHash` is a successful on-chain ERC-20 Transfer of at least
 * `amountToken` from `owner` to the order's `depositAddress`.
 *
 * We verify by EVENT LOGS, not `receipt.from` / `receipt.to`: MetaMask Smart
 * Accounts (EIP-7702) relay the transaction, so the receipt sender is a relayer
 * while the Transfer log still proves the real owner moved the funds.
 *
 * Returns null on success or a human-readable rejection reason.
 */
async function verifySettlementTransfer(args: {
  network: string;
  txHash: string;
  owner: string;
  depositAddress: string;
  tokenAddress: string;
  amountToken: bigint;
}): Promise<string | null> {
  const receipt = await getReceipt(args.network, args.txHash);
  if (!receipt) return "Transfer not found on-chain yet. Wait a few seconds and retry.";
  if (receipt.status !== "0x1") return "The token transfer failed on-chain.";

  const ownerTopic = padToTopic(args.owner);
  const depositTopic = padToTopic(args.depositAddress);
  let sent = 0n;
  const seen: Array<{ from: string; to: string; value: string }> = [];

  for (const log of receipt.logs) {
    if (!eqAddress(log.address, args.tokenAddress)) continue;
    if ((log.topics?.[0] ?? "").toLowerCase() !== TRANSFER_TOPIC) continue;

    let value = 0n;
    try {
      value = hexToBigInt(log.data);
    } catch {
      value = 0n;
    }
    seen.push({ from: log.topics?.[1] ?? "", to: log.topics?.[2] ?? "", value: value.toString() });

    if ((log.topics?.[1] ?? "").toLowerCase() !== ownerTopic) continue;
    if ((log.topics?.[2] ?? "").toLowerCase() !== depositTopic) continue;
    sent += value;
  }

  if (sent === 0n) {
    return (
      "That transaction does not contain a token transfer to the Element Pay deposit address. " +
      `Expected ${args.owner} -> ${args.depositAddress} on token ${args.tokenAddress}. ` +
      `Transfers found: ${seen.length ? JSON.stringify(seen) : "none"}.`
    );
  }
  if (sent < args.amountToken) {
    return `Amount sent (${sent.toString()}) is less than the order amount (${args.amountToken.toString()}).`;
  }
  return null;
}

/** Deposit wallet Element Pay expects the tokens at for this order. */
function extractDepositAddress(order: Record<string, unknown>): string | null {
  const candidate = pickString(order, [
    "wallet_address",
    "deposit_address",
    "receive_address",
    "settlement_address",
    "escrow_address",
    "payin_address",
  ]);
  return isAddress(candidate) ? (candidate as string).toLowerCase() : null;
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

    // -----------------------------------------------------------------------
    // action: "settlement" — bind the user's on-chain transfer to the order.
    // -----------------------------------------------------------------------
    if (body?.action === "settlement") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const reference = typeof body.reference === "string" ? body.reference : "";
      const txHash = isTxHash(body.txHash) ? (body.txHash as string).toLowerCase() : null;
      if (!reference || !txHash) {
        return json({ status: "error", error: "reference and txHash are required", code: "BAD_REQUEST" }, 400);
      }

      const { data: row } = await supabase
        .from("transactions")
        .select("id,reference,paycrest_order_id,receive_address,network,amount_usdt,approval_tx_hash,status")
        .eq("reference", reference)
        .maybeSingle();

      if (!row?.paycrest_order_id || String(row.paycrest_order_id).startsWith("QUOTE:")) {
        return json({ status: "error", error: "No accepted order found for this reference", code: "ORDER_NOT_FOUND" }, 404);
      }
      if (row.approval_tx_hash && row.approval_tx_hash !== txHash) {
        return json({ status: "error", error: "This order already has a settlement transaction", code: "ALREADY_SETTLED" }, 409);
      }

      // The same transfer must never settle two different orders.
      const { data: hashOwner } = await supabase
        .from("transactions")
        .select("reference")
        .eq("approval_tx_hash", txHash)
        .maybeSingle();
      if (hashOwner && hashOwner.reference !== reference) {
        return json({ status: "error", error: "This transaction is already used by another order", code: "TX_ALREADY_USED" }, 409);
      }

      const orderRes = await epFetch(`/partner/orders/${encodeURIComponent(row.paycrest_order_id)}`, apiKey, { method: "GET" });
      if (!orderRes.ok) {
        return json({ status: "error", error: formatProviderError(orderRes.body, "Could not read the order"), code: "PROVIDER_UNAVAILABLE" }, 502);
      }
      const order = extractOrderData(orderRes.body);
      const depositAddress = extractDepositAddress(order);
      if (!depositAddress) {
        return json({ status: "error", error: "Element Pay did not return a deposit address for this order", code: "NO_DEPOSIT_ADDRESS" }, 502);
      }

      const tokenAddress = isAddress(body.token) ? (body.token as string).toLowerCase() : DEFAULT_TOKEN_ADDRESS;
      if (!(tokenAddress in TOKEN_SYMBOLS)) {
        return json({ status: "error", error: "Unsupported token", code: "TOKEN_UNSUPPORTED" }, 400);
      }
      const decimals = decimalsFor(tokenAddress);
      const expectedDecimal =
        pickNumber(order, ["amount_crypto", "crypto_amount"]) ?? Number(row.amount_usdt ?? 0);
      // 1 wei of slack for float rounding on the decimal amount.
      const expectedBase = BigInt(Math.max(0, Math.round(expectedDecimal * 10 ** decimals) - 1));

      const failure = await verifySettlementTransfer({
        network: typeof row.network === "string" ? row.network : "base",
        txHash,
        owner: String(row.receive_address ?? ""),
        depositAddress,
        tokenAddress,
        amountToken: expectedBase,
      });
      if (failure) {
        return json({ status: "error", error: failure, code: "SETTLEMENT_INVALID" }, 400);
      }

      const { error: updErr } = await supabase
        .from("transactions")
        .update({ approval_tx_hash: txHash, status: "processing" })
        .eq("id", row.id);
      if (updErr) console.error("[elementpay-offramp] settlement update failed:", updErr.message);

      return json({
        status: "success",
        data: { reference, txHash, orderId: row.paycrest_order_id, depositAddress, status: "processing" },
      });
    }

    const {
      amountFiat,
      cashoutType,
      phoneNumber,
      tillNumber,
      paybillNumber,
      accountNumber,
      bankCode,
      network,
      narrative,
      clientRef,
      recipientName,
      userAddress: rawUserAddress,
      token: rawToken,
      amountToken,
      tokenDecimals,
      resumeQuoteId: rawResumeQuoteId,
    } = body;

    // Validate (amountFiat is denominated in KES, mirroring onramp)
    if (!amountFiat || Number(amountFiat) <= 0) {
      return json({ status: "error", error: "A valid amount is required" }, 400);
    }
    if (cashoutType === "PHONE" && !phoneNumber) return json({ status: "error", error: "Phone number required" }, 400);

    if (!isAddress(rawUserAddress)) {
      return json({ status: "error", error: "Connect a wallet to sell. A valid wallet address is required.", code: "WALLET_REQUIRED" }, 400);
    }
    const userAddress = (rawUserAddress as string).toLowerCase();
    const token = isAddress(rawToken) ? (rawToken as string).toLowerCase() : DEFAULT_TOKEN_ADDRESS;

    // No wallet signature is needed to CREATE the order. The user pays the
    // order afterwards by sending tokens to the deposit address we return.
    const networkKey = typeof network === "string" ? network : "base";
    if (!SUPPORTED_SELL_NETWORKS.includes(networkKey)) {
      return json({
        status: "error",
        error: `Network ${networkKey} is not supported for sell yet.`,
        code: "NETWORK_UNSUPPORTED",
      }, 400);
    }

    if (typeof amountToken !== "string" || !/^\d+$/.test(amountToken)) {
      return json({
        status: "error",
        error: "amountToken (base units) is required.",
        code: "AMOUNT_TOKEN_REQUIRED",
      }, 400);
    }
    const amountTokenBig = BigInt(amountToken);

    // Enforce the sell limits (token units). Decimals come from the client so
    // we don't have to guess per-chain token precision.
    const decimals = Number.isInteger(tokenDecimals) && tokenDecimals > 0 && tokenDecimals <= 36
      ? Number(tokenDecimals)
      : 6;
    const amountTokenDecimal = Number(amountTokenBig) / 10 ** decimals;
    const sellLimits = await resolveSellLimits(apiKey);
    if (amountTokenDecimal < sellLimits.min || amountTokenDecimal > sellLimits.max) {
      return json({
        status: "error",
        error: `Amount must be between ${sellLimits.min.toLocaleString()} and ${sellLimits.max.toLocaleString()} tokens.`,
        code: "AMOUNT_OUT_OF_RANGE",
        debug: { limits: sellLimits, amountTokenDecimal },
      }, 400);
    }

    // When the client is retrying an order whose quote already exists, reuse
    // that quote — never create a second Element Pay order for one approval.
    const resumeQuoteId = typeof rawResumeQuoteId === "string" && /^[A-Za-z0-9_\-:.]{6,120}$/.test(rawResumeQuoteId)
      ? rawResumeQuoteId
      : null;

    // Init Supabase early so we can do the replay check before talking to ElementPay.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const safeClientRef = typeof clientRef === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(clientRef)
      ? clientRef
      : null;
    const reference = safeClientRef || `NYT-SELL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Idempotency: one Element Pay order per client reference. If this
    // reference already produced an accepted order, return it instead of
    // quoting again (a retry after a flaky fetch must never create a 2nd order).
    // A row whose provider id is still `QUOTE:<id>` means the quote exists but
    // accept never completed — we resume that exact quote below.
    const { data: existingByRef } = await supabase
      .from("transactions")
      .select("reference,paycrest_order_id,status,rate_used,amount_usdt,amount_kes")
      .eq("reference", reference)
      .maybeSingle();

    let pendingQuoteId: string | null = null;
    const existingProviderId = existingByRef?.paycrest_order_id ?? null;
    if (existingProviderId) {
      if (existingProviderId.startsWith("QUOTE:")) {
        pendingQuoteId = existingProviderId.slice("QUOTE:".length);
      } else {
        console.log("[elementpay-offramp] idempotent hit — returning existing order", reference, existingProviderId);
        const readBack = await epFetch(`/partner/orders/${encodeURIComponent(existingProviderId)}`, apiKey, { method: "GET" });
        const existingOrder = readBack.ok ? extractOrderData(readBack.body) : {};
        const existingDeposit = extractDepositAddress(existingOrder);
        return json({
          status: "success",
          data: {
            reference,
            txHash: existingProviderId,
            status: existingByRef?.status ?? "pending",
            rateUsed: existingByRef?.rate_used ?? 0,
            amountSent: existingByRef?.amount_usdt ?? 0,
            fiatPaid: existingByRef?.amount_kes ?? Number(amountFiat),
            idempotent: true,
            deposit: existingDeposit
              ? {
                address: existingDeposit,
                amount: pickNumber(existingOrder, ["amount_crypto", "crypto_amount"]) ?? amountTokenDecimal,
                token,
                network: networkKey,
              }
              : null,
          },
        });
      }
    }


    const effectiveCashoutType = cashoutType || "PHONE";
    const msisdn = toE164(phoneNumber);
    if (effectiveCashoutType === "PHONE" && !msisdn) {
      return json({ status: "error", error: "Invalid phone number" }, 400);
    }

    const networkId = await resolveMobileMoneyNetworkId(apiKey, "mpesa", "KE");

    const paymentMethod: Record<string, unknown> = effectiveCashoutType === "PHONE"
      ? { type: "mobile_money", phone_number: msisdn, network_id: networkId, account_name: recipientName || "Nyati Customer" }
      : effectiveCashoutType === "TILL"
      ? { type: "mobile_money", till_number: tillNumber, phone_number: msisdn, network_id: networkId, account_name: recipientName || "Nyati Customer" }
      : {
        type: "mobile_money",
        paybill_number: paybillNumber,
        account_number: accountNumber,
        phone_number: msisdn,
        network_id: networkId,
        account_name: recipientName || "Nyati Customer",
      };

    if (effectiveCashoutType !== "PHONE" && bankCode) paymentMethod.bank_code = bankCode;

    // Step 1 — quote (skipped entirely when resuming an existing quote, so a
    // single wallet approval can never produce two Element Pay orders).
    // `pendingQuoteId` is the server-side memory of a quote whose accept never
    // completed, so even a client that lost `resumeQuoteId` resumes correctly.
    let quoteId: string | null = resumeQuoteId ?? pendingQuoteId;
    let quoteBody: Record<string, unknown> = {};


    if (!quoteId) {
      // Element Pay's off-ramp routes are priced from the CRYPTO side: the
      // route requirements list `crypto_amount` (decimal token units), not
      // `local_amount`. We send crypto_amount first and only fall back to the
      // fiat-priced payload if the provider asks for local_amount instead.
      const cryptoAmount = Number(amountTokenDecimal.toFixed(Math.min(decimals, 8)));

      // The KE corridor requires a complete retail KYC block on the quote.
      const raw = body as Record<string, unknown>;
      const str = (key: string, fallback: string) => {
        const v = raw[key];
        return typeof v === "string" && v.trim() ? v.trim() : fallback;
      };

      const baseQuotePayload: Record<string, unknown> = {
        order_type: "OffRamp",
        currency: "KES",
        country: "KE",
        asset: {
          token,
          currency: tokenSymbolFor(token, (body as Record<string, unknown>).tokenSymbol),
          network: toEpNetwork(networkKey),
        },
        customer: {
          uid: reference,
          type: "user",
          name: str("customerName", recipientName || "Nyati Customer"),
          phone: msisdn,
          country: "KE",
          address: str("customerAddress", "Nairobi"),
          dob: str("customerDob", ""),
          email: str("customerEmail", ""),
          id_number: str("customerIdNumber", ""),
          id_type: str("customerIdType", "national_id"),
        },

        payment_method: paymentMethod,
        wallet_address: userAddress,
        refund_address: userAddress,
        reference,
        narrative: narrative || `Nyati Sell - ${reference}`,
      };

      let quotePayload: Record<string, unknown> = { ...baseQuotePayload, crypto_amount: cryptoAmount };

      console.log("[elementpay-offramp] quote", JSON.stringify(quotePayload));
      let quoteRes = await epFetch("/partner/orders/quote", apiKey, {
        method: "POST",
        body: quotePayload,
      });
      console.log("[elementpay-offramp] quote response", quoteRes.status, quoteRes.raw.slice(0, 1200));

      // Route wants the fiat side (or both) — retry once with local_amount.
      if (!quoteRes.ok && /local_amount|fiat_amount/i.test(quoteRes.raw)) {
        quotePayload = {
          ...baseQuotePayload,
          crypto_amount: cryptoAmount,
          local_amount: Math.round(Number(amountFiat)),
        };
        console.log("[elementpay-offramp] quote retry", JSON.stringify(quotePayload));
        quoteRes = await epFetch("/partner/orders/quote", apiKey, {
          method: "POST",
          body: quotePayload,
        });
        console.log("[elementpay-offramp] quote retry response", quoteRes.status, quoteRes.raw.slice(0, 1200));
      }

      if (!quoteRes.ok) {
        const isServerError = quoteRes.status >= 500;
        return json({
          status: "error",
          error: formatProviderError(quoteRes.body, "Failed to quote sell order"),
          code: isServerError ? "PROVIDER_UNAVAILABLE" : "QUOTE_FAILED",
          fallback: isServerError,
          debug: { providerStatus: quoteRes.status, sent: quotePayload, raw: quoteRes.body },
        });
      }

      quoteBody = quoteRes.body;
      quoteId = extractQuoteId(quoteRes.body);
      if (!quoteId) {
        return json({
          status: "error",
          error: "Element Pay did not return a quote id",
          code: "QUOTE_FAILED",
          debug: { raw: quoteRes.body },
        });
      }

      // Persist the quote BEFORE accept. If this request dies (or the browser
      // retries), the next call finds `QUOTE:<id>` and resumes the same order.
      const { error: quoteRowError } = await supabase.from("transactions").upsert({
        reference,
        paycrest_order_id: `QUOTE:${quoteId}`,
        phone_number: msisdn ?? "",
        recipient_name: recipientName || "",
        institution: effectiveCashoutType,
        amount_usdt: amountTokenDecimal,
        amount_kes: Number(amountFiat),
        network: networkKey,
        receive_address: userAddress,
        sender_fee: 0,
        transaction_fee: 0,
        status: "pending",
        provider: "elementpay",
        order_type: "offramp",
        cashout_type: effectiveCashoutType,
      }, { onConflict: "reference" });
      if (quoteRowError) console.error("[elementpay-offramp] quote row upsert failed:", quoteRowError.message);
    } else {
      console.log("[elementpay-offramp] resuming existing quote", quoteId);
    }


    // Step 2 — accept. The accept schema (additionalProperties:false) only
    // allows { provider?, payment_method? }; an EMPTY object is the documented
    // call for local fiat rail. Do NOT send `reference`/`approval_tx_hash`
    // here — Element Pay rejects unknown fields with "Validation error".
    let acceptRes = await epFetch(`/partner/orders/${encodeURIComponent(quoteId)}/accept`, apiKey, {
      method: "POST",
      body: {},
    });
    console.log("[elementpay-offramp] accept response", acceptRes.status, acceptRes.raw.slice(0, 1200));

    // Re-running accept for a quote that was already accepted is not a failure:
    // read the order back instead of creating a second one.
    if (!acceptRes.ok && /already|accepted|state|status/i.test(acceptRes.raw) && acceptRes.status < 500) {
      const readBack = await epFetch(`/partner/orders/${encodeURIComponent(quoteId)}`, apiKey, { method: "GET" });
      console.log("[elementpay-offramp] accept read-back", readBack.status, readBack.raw.slice(0, 1200));
      if (readBack.ok) acceptRes = readBack;
    }

    if (!acceptRes.ok) {
      const isServerError = acceptRes.status >= 500;
      return json({
        status: "error",
        error: formatProviderError(acceptRes.body, "Failed to create sell order"),
        code: isServerError ? "PROVIDER_UNAVAILABLE" : "ORDER_CREATE_FAILED",
        fallback: isServerError,
        // quoteId lets the client retry the SAME order instead of creating a new one.
        quoteId,
        debug: { providerStatus: acceptRes.status, quoteId, raw: acceptRes.body },
      });
    }

    const quoteData = extractOrderData(quoteBody);
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

    // Upsert on `reference`: retries of the same client reference update the
    // existing row instead of creating a duplicate payout record.
    const { error: upsertError } = await supabase.from("transactions").upsert({
      reference,
      paycrest_order_id: orderId,
      phone_number: msisdn ?? "",
      recipient_name: recipientName || "",
      institution: effectiveCashoutType,
      amount_usdt: amountSent,
      amount_kes: Number(amountFiat),
      rate_used: rateUsed,
      nyati_fee_percent: 0,
      network: networkKey,
      receive_address: userAddress,
      sender_fee: 0,
      transaction_fee: 0,
      status: "pending",
      provider: "elementpay",
      order_type: "offramp",
      cashout_type: effectiveCashoutType,
      till_number: tillNumber || null,
      paybill_number: paybillNumber || null,
      account_number: accountNumber || null,
    }, { onConflict: "reference" });
    if (upsertError) console.error("[elementpay-offramp] transaction upsert failed:", upsertError.message);

    // The user pays this order by SENDING tokens here. Without it the order
    // can never settle, so treat a missing deposit address as a hard failure.
    const depositAddress = extractDepositAddress(orderData);
    if (!depositAddress) {
      console.error("[elementpay-offramp] no deposit address on order", orderId, JSON.stringify(orderData).slice(0, 1500));
      return json({
        status: "error",
        error: "Element Pay did not return a deposit address for this order. Nothing was sent from your wallet.",
        code: "NO_DEPOSIT_ADDRESS",
        quoteId,
        debug: { order: orderData },
      });
    }

    const depositAmount =
      pickNumber(orderData, ["amount_crypto", "crypto_amount"]) ?? amountTokenDecimal;

    console.log("[elementpay-offramp] order created", JSON.stringify({
      reference,
      orderId,
      depositAddress,
      depositAmount,
      providerStatus: pickString(orderData, ["status", "state"]),
    }));

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
        deposit: {
          address: depositAddress,
          amount: depositAmount,
          token,
          network: networkKey,
        },
      },
    });


  } catch (error) {
    console.error("[elementpay-offramp] Unexpected error:", error);
    return json({
      status: "error",
      error: error instanceof Error ? error.message : "Unexpected error",
      code: "UNEXPECTED_ERROR",
      fallback: true,
    });
  }
});
