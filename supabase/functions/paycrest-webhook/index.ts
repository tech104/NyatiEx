import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paycrest-signature",
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("X-Paycrest-Signature");
    const apiSecret = Deno.env.get("PAYCREST_API_SECRET");

    const rawBody = await req.text();

    if (signature && apiSecret) {
      const valid = await verifySignature(rawBody, signature, apiSecret);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    // Map Paycrest event to our status
    const statusMap: Record<string, string> = {
      "payment_order.pending": "pending",
      "payment_order.validated": "validated",
      "payment_order.settled": "settled",
      "payment_order.expired": "expired",
      "payment_order.refunded": "refunded",
    };

    const newStatus = statusMap[event];
    if (!newStatus) {
      return new Response(
        JSON.stringify({ message: "Unknown event type", event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update by paycrest_order_id
    const { error } = await supabase
      .from("transactions")
      .update({ status: newStatus })
      .eq("paycrest_order_id", data.id);

    if (error) {
      console.error("Failed to update transaction:", error);
    }

    return new Response(
      JSON.stringify({ status: "success", message: "Webhook processed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
