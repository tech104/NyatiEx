import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Element Pay base URL — per docs, all endpoints live under /api/v1.
// Canonical status lookup: GET /orders/tx/{tx_hash}.
const ELEMENTPAY_BASE = "https://api.elementpay.net/api/v1";

// Build version marker so we can verify the deployed function matches the repo.
const FN_VERSION = "elementpay-order-status@2026-04-23-strict-1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type AppStatus =
  | "pending"
  | "processing"
  | "validated"
  | "settled"
  | "expired"
  | "refunded";

const STATUS_MAP: Record<string, AppStatus> = {
  // Pending family
  pending: "pending",
  submitted: "pending",
  submitted_to_provider: "pending",
  provider_submitted: "pending",
  new: "pending",
  created: "pending",
  awaiting_payment: "pending",
  awaiting_user: "pending",

  // Processing family
  processing: "processing",
  in_progress: "processing",

  // Validated family (intermediate, NOT terminal success)
  validated: "validated",
  confirmed: "validated",

  // Terminal success
  settled: "settled",
  completed: "settled",
  complete: "settled",
  fulfilled: "settled",
  paid: "settled",
  success: "settled",

  // Terminal failure
  failed: "expired",
  failure: "expired",
  cancelled: "expired",
  canceled: "expired",
  expired: "expired",
  rejected: "expired",
  error: "expired",

  // Refund
  refunded: "refunded",
  reversed: "refunded",
};

const TERMINAL_STATUSES: AppStatus[] = ["settled", "expired", "refunded"];
const isTerminal = (status: AppStatus | null) => !!status && TERMINAL_STATUSES.includes(status);

function mapStatusString(raw: unknown): AppStatus | null {
  if (typeof raw !== "string") return null;
  const key = raw.toLowerCase().trim();
  if (!key) return null;
  return STATUS_MAP[key] ?? null;
}

/**
 * STRICT extractor.
 * We only ever consult explicit, whitelisted ORDER status fields.
 * Transport-level fields like the root `status` ("success") and
 * arbitrary nested strings are intentionally ignored, because they
 * can falsely appear settled when the order itself is still pending.
 */
function extractProviderStatus(
  payload: unknown
): { status: AppStatus | null; rawStatus: string | null; mappedFrom: string | null } {
  if (!payload || typeof payload !== "object") {
    return { status: null, rawStatus: null, mappedFrom: null };
  }

  const root = payload as Record<string, unknown>;

  const candidates: Array<{ value: unknown; path: string }> = [];

  // 1. data.status  (Element Pay's documented order status field)
  const data = root.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    candidates.push({ value: dataObj.status, path: "data.status" });
    candidates.push({ value: dataObj.order_status, path: "data.order_status" });

    const order = dataObj.order;
    if (order && typeof order === "object") {
      const orderObj = order as Record<string, unknown>;
      candidates.push({ value: orderObj.status, path: "data.order.status" });
      candidates.push({ value: orderObj.order_status, path: "data.order.order_status" });
    }
  }

  // 2. order.status at the root
  const rootOrder = root.order;
  if (rootOrder && typeof rootOrder === "object") {
    const orderObj = rootOrder as Record<string, unknown>;
    candidates.push({ value: orderObj.status, path: "order.status" });
    candidates.push({ value: orderObj.order_status, path: "order.order_status" });
  }

  // NOTE: we intentionally do NOT consider `root.status` — that's the
  // transport envelope ("success" / "error"), not the order state.

  for (const { value, path } of candidates) {
    if (typeof value !== "string") continue;
    const mapped = mapStatusString(value);
    if (mapped) {
      return { status: mapped, rawStatus: value, mappedFrom: path };
    }
  }

  return { status: null, rawStatus: null, mappedFrom: null };
}

async function tryFetch(url: string, apiKey: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    const preview = text.slice(0, 400);
    console.log(`[${FN_VERSION}] ${res.status} ${url} -> ${preview}`);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // non-JSON
    }
    return { ok: res.ok, status: res.status, body: parsed, bodyPreview: preview };
  } catch (err) {
    console.log(`[${FN_VERSION}] fetch error ${url}:`, err);
    return { ok: false, status: 0, body: null, bodyPreview: String(err) };
  }
}

async function fetchProviderStatus(apiKey: string, txHash: string | null, clientRef: string | null) {
  const candidates: string[] = [];
  if (txHash) {
    candidates.push(
      `${ELEMENTPAY_BASE}/partner/orders/${encodeURIComponent(txHash)}`,
      `${ELEMENTPAY_BASE}/orders/tx/${encodeURIComponent(txHash)}`,
      `${ELEMENTPAY_BASE}/orders/${encodeURIComponent(txHash)}`,
    );
  }
  if (clientRef) {
    candidates.push(
      `${ELEMENTPAY_BASE}/partner/orders?reference=${encodeURIComponent(clientRef)}`,
      `${ELEMENTPAY_BASE}/orders/ref/${encodeURIComponent(clientRef)}`,
      `${ELEMENTPAY_BASE}/orders?client_ref=${encodeURIComponent(clientRef)}`,
    );
  }


  const attempts: Array<{ url: string; status: number; bodyPreview: string }> = [];
  for (const url of candidates) {
    const r = await tryFetch(url, apiKey);
    attempts.push({ url, status: r.status, bodyPreview: r.bodyPreview });
    if (r.ok && r.body) {
      return { ok: true, url, body: r.body, attempts };
    }
  }
  return { ok: false, url: null, body: null, attempts };
}

/**
 * Decide whether to write the provider status back to the DB.
 * Rules:
 *  - Always allow if the DB row is currently non-terminal.
 *  - If the DB row is "settled" but the provider explicitly reports
 *    a non-success state (pending/processing/validated/expired/refunded),
 *    we REPAIR the row. This handles previously poisoned rows.
 *  - Never downgrade an "expired" or "refunded" terminal state.
 */
function shouldReconcile(currentDbStatus: string | null, providerStatus: AppStatus): boolean {
  if (!currentDbStatus) return true;
  if (currentDbStatus === providerStatus) return false;

  // Repair a previously poisoned settled row.
  if (currentDbStatus === "settled" && providerStatus !== "settled") return true;

  // Don't bounce away from real failure terminals.
  if (currentDbStatus === "expired" || currentDbStatus === "refunded") return false;

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const reference = typeof body.reference === "string" ? body.reference : null;
    const txHashIn = typeof body.txHash === "string" ? body.txHash : null;

    if (!reference && !txHashIn) {
      return json({ status: "error", error: "reference or txHash is required", version: FN_VERSION }, 400);
    }

    let dbTx: Record<string, any> | null = null;
    if (reference) {
      const { data } = await supabase
        .from("transactions")
        .select(
          "id,reference,status,paycrest_order_id,amount_usdt,amount_kes,rate_used,receive_address,network,provider"
        )
        .eq("reference", reference)
        .maybeSingle();
      dbTx = data ?? null;
    }

    // A `QUOTE:<id>` provider id means accept never completed for that row —
    // strip the marker so we still look the quote up with Element Pay.
    const storedProviderId: string | null = dbTx?.paycrest_order_id ?? null;
    const txHash =
      txHashIn ||
      (storedProviderId && storedProviderId.startsWith("QUOTE:")
        ? storedProviderId.slice("QUOTE:".length)
        : storedProviderId);
    const clientRef = reference ?? (dbTx?.reference ?? null);
    const apiKey = Deno.env.get("ELEMENTPAY_API_KEY");

    let providerStatus: AppStatus | null = null;
    let providerRawStatus: string | null = null;
    let providerMappedFrom: string | null = null;
    let providerRaw: unknown = null;
    let providerAttempts: Array<{ url: string; status: number; bodyPreview: string }> = [];
    const providerChecked = Boolean(apiKey && (txHash || clientRef));

    if (apiKey && (txHash || clientRef)) {
      const result = await fetchProviderStatus(apiKey, txHash, clientRef);
      providerAttempts = result.attempts;
      if (result.ok && result.body) {
        providerRaw = result.body;
        const extracted = extractProviderStatus(result.body);
        providerStatus = extracted.status;
        providerRawStatus = extracted.rawStatus;
        providerMappedFrom = extracted.mappedFrom;

        console.log(
          `[${FN_VERSION}] extracted provider status:`,
          JSON.stringify({
            providerStatus,
            providerRawStatus,
            providerMappedFrom,
            currentDbStatus: dbTx?.status ?? null,
          })
        );

        if (providerStatus && dbTx && shouldReconcile(dbTx.status, providerStatus)) {
          console.log(`[${FN_VERSION}] reconcile tx ${dbTx.id}: ${dbTx.status} -> ${providerStatus}`);
          const { data: updated, error: updErr } = await supabase
            .from("transactions")
            .update({ status: providerStatus })
            .eq("id", dbTx.id)
            .select(
              "id,reference,status,paycrest_order_id,amount_usdt,amount_kes,rate_used,receive_address,network,provider"
            )
            .maybeSingle();
          if (updErr) console.error(`[${FN_VERSION}] DB update error:`, updErr.message);
          if (updated) dbTx = updated;
        }
      }
    } else if (!apiKey) {
      console.warn(`[${FN_VERSION}] ELEMENTPAY_API_KEY not configured`);
    }

    return json({
      status: "success",
      version: FN_VERSION,
      data: {
        transaction: dbTx,
        provider: {
          checked: providerChecked,
          status: providerStatus,            // mapped AppStatus or null
          rawStatus: providerRawStatus,      // exact string from provider
          mappedFrom: providerMappedFrom,    // which field we read
          raw: providerRaw,
          attempts: providerAttempts,
        },
      },
    });
  } catch (error) {
    console.error(`[${FN_VERSION}] Unexpected error:`, error);
    return json(
      {
        status: "error",
        version: FN_VERSION,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      500
    );
  }
});
