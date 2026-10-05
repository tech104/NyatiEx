import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-elementpay-signature",
};

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function parseSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signature = parts.find((part) => part.startsWith("v1="))?.slice(3);
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

async function verifySignature(body: string, signatureHeader: string, secret: string): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const timestampMs = Number(parsed.timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${parsed.timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return timingSafeEqual(expected, parsed.signature);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Capture raw payload + headers up front so we can always log, even on error
  const headerEntries: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    // Strip auth-bearing headers from the log
    if (["authorization", "apikey", "cookie"].includes(key.toLowerCase())) return;
    headerEntries[key] = value;
  });

  let rawBody = "";
  let payload: any = null;
  let signatureValid: boolean | null = null;
  let logError: string | null = null;

  try {
    const signature =
      req.headers.get("X-Webhook-Signature") ||
      req.headers.get("x-webhook-signature") ||
      req.headers.get("X-ElementPay-Signature") ||
      req.headers.get("x-elementpay-signature");
    const webhookSecret = Deno.env.get("ELEMENTPAY_WEBHOOK_SECRET");
    rawBody = await req.text();

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      signatureValid = await verifySignature(rawBody, signature, webhookSecret);
      if (!signatureValid) {
        await logEvent(supabase, {
          event_type: null,
          status: null,
          signature_valid: false,
          tx_hash: null,
          client_ref: null,
          matched_transaction_id: null,
          payload: safeParse(rawBody),
          headers: headerEntries,
          error: "Invalid signature",
        });
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (webhookSecret && !signature) {
      signatureValid = false;
    } else {
      signatureValid = null;
    }

    payload = JSON.parse(rawBody);
    const { event, data } = payload;

    // Map Element Pay events to our statuses
    const statusMap: Record<string, string> = {
      "order.submitted": "pending",
      "order.settled": "settled",
      "order.failed": "expired",
      "order.refunded": "refunded",
    };

    const newStatus = statusMap[event];
    const txHash = data?.tx_hash ?? null;
    const clientRef = data?.client_ref ?? null;
    let matchedId: string | null = null;

    if (newStatus) {
      // Try to update by tx_hash (stored in paycrest_order_id) or client_ref (stored in reference)
      if (txHash) {
        const { data: rows, error } = await supabase
          .from("transactions")
          .update({ status: newStatus })
          .eq("paycrest_order_id", txHash)
          .eq("provider", "elementpay")
          .select("id");
        if (error) logError = error.message;
        matchedId = rows?.[0]?.id ?? null;
      } else if (clientRef) {
        const { data: rows, error } = await supabase
          .from("transactions")
          .update({ status: newStatus })
          .eq("reference", clientRef)
          .eq("provider", "elementpay")
          .select("id");
        if (error) logError = error.message;
        matchedId = rows?.[0]?.id ?? null;
      }
    }

    await logEvent(supabase, {
      event_type: event ?? null,
      status: newStatus ?? null,
      signature_valid: signatureValid,
      tx_hash: txHash,
      client_ref: clientRef,
      matched_transaction_id: matchedId,
      payload,
      headers: headerEntries,
      error: logError,
    });

    if (!newStatus) {
      return new Response(
        JSON.stringify({ message: "Unknown event type", event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "success", message: "Webhook processed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEvent(supabase, {
      event_type: payload?.event ?? null,
      status: null,
      signature_valid: signatureValid,
      tx_hash: payload?.data?.tx_hash ?? null,
      client_ref: payload?.data?.client_ref ?? null,
      matched_transaction_id: null,
      payload: payload ?? safeParse(rawBody),
      headers: headerEntries,
      error: message,
    });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function safeParse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

async function logEvent(
  supabase: any,
  row: {
    event_type: string | null;
    status: string | null;
    signature_valid: boolean | null;
    tx_hash: string | null;
    client_ref: string | null;
    matched_transaction_id: string | null;
    payload: unknown;
    headers: Record<string, string>;
    error: string | null;
  }
) {
  const { error } = await supabase.from("webhook_events").insert({
    provider: "elementpay",
    ...row,
  });
  if (error) {
    // Surface to function logs but don't crash the webhook
    console.error("[webhook_events] insert failed:", error.message);
  }
}
