import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseJsonSafely = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getProviderMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const network = typeof body.network === "string" ? body.network : "";
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber : "";
    const recipientName = typeof body.recipientName === "string" ? body.recipientName : "";
    const institution = typeof body.institution === "string" ? body.institution : "MPESA";

    if (!Number.isFinite(amount) || amount < 0.5) {
      return jsonResponse({ error: "Minimum amount is $0.50" }, 400);
    }

    if (!phoneNumber || !/^\+?[0-9]{10,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
      return jsonResponse({ error: "Invalid phone number format" }, 400);
    }

    if (!recipientName || recipientName.trim().length < 2) {
      return jsonResponse({ error: "Recipient name is required" }, 400);
    }

    if (!network) {
      return jsonResponse({ error: "Network is required" }, 400);
    }

    const apiKey = Deno.env.get("PAYCREST_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "Paycrest API key not configured" }, 500);
    }

    const returnAddress = Deno.env.get("PAYCREST_RETURN_ADDRESS") || "";
    const nyatiFeePercent = parseFloat(Deno.env.get("NYATI_FEE_PERCENT") || "1.5");

    const rateRes = await fetch(
      `https://api.paycrest.io/v1/rates/USDT/${amount}/KES?network=${network}`,
      { headers: { "Content-Type": "application/json" } }
    );

    const rateText = await rateRes.text();
    const ratePayload = parseJsonSafely(rateText);

    if (!rateRes.ok) {
      const providerMessage = getProviderMessage(ratePayload, rateText || "Failed to fetch rate");
      const isUnavailable = providerMessage.toLowerCase().includes("no provider available");

      return jsonResponse({
        status: "error",
        error: isUnavailable
          ? "No payout provider is available for this amount on this network right now. Try a smaller amount."
          : "Failed to fetch rate",
        code: isUnavailable ? "RATE_UNAVAILABLE" : "RATE_FETCH_FAILED",
        details: providerMessage,
        fallback: false,
      });
    }

    const paycrestRate = Number(ratePayload?.data);
    if (!Number.isFinite(paycrestRate) || paycrestRate <= 0) {
      return jsonResponse({
        status: "error",
        error: "Invalid rate received from provider",
        code: "INVALID_RATE",
        fallback: false,
      });
    }

    const reference = `NYT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const cleanPhone = phoneNumber.replace(/\s/g, "");

    const orderPayload = {
      amount,
      token: "USDT",
      network,
      rate: paycrestRate,
      recipient: {
        institution,
        accountIdentifier: cleanPhone,
        accountName: recipientName.trim(),
        currency: "KES",
        memo: `Nyati Exchange - ${reference}`,
      },
      reference,
      returnAddress,
    };

    const orderRes = await fetch("https://api.paycrest.io/v1/sender/orders", {
      method: "POST",
      headers: {
        "API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const orderText = await orderRes.text();
    const orderResult = parseJsonSafely(orderText);

    if (!orderRes.ok || orderResult?.status !== "success") {
      const providerMessage = getProviderMessage(orderResult, orderText || "Failed to create order");

      return jsonResponse({
        status: "error",
        error: "Failed to create order",
        code: "ORDER_CREATE_FAILED",
        details: providerMessage,
        fallback: false,
      });
    }

    const orderData = orderResult.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const nyatiRate = paycrestRate * (1 - nyatiFeePercent / 100);
    const amountKes = amount * nyatiRate;

    const { data: txData, error: txError } = await supabase
      .from("transactions")
      .insert({
        reference,
        paycrest_order_id: orderData.id,
        phone_number: cleanPhone,
        recipient_name: recipientName.trim(),
        institution,
        amount_usdt: amount,
        amount_kes: Math.round(amountKes * 100) / 100,
        rate_used: nyatiRate,
        nyati_fee_percent: nyatiFeePercent,
        network,
        receive_address: orderData.receiveAddress,
        sender_fee: orderData.senderFee || 0,
        transaction_fee: orderData.transactionFee || 0,
        status: "pending",
        valid_until: orderData.validUntil || null,
      })
      .select()
      .single();

    if (txError) {
      console.error("DB insert error:", txError);
    }

    return jsonResponse({
      status: "success",
      data: {
        id: txData?.id || orderData.id,
        reference,
        receiveAddress: orderData.receiveAddress,
        amount,
        senderFee: orderData.senderFee || 0,
        transactionFee: orderData.transactionFee || 0,
        totalToSend: amount + (orderData.senderFee || 0) + (orderData.transactionFee || 0),
        amountKes: Math.round(amountKes * 100) / 100,
        rate: nyatiRate,
        network,
        validUntil: orderData.validUntil,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Unexpected paycrest-offramp error:", error);

    return jsonResponse({
      status: "error",
      error: error instanceof Error ? error.message : "Unexpected error",
      code: "UNEXPECTED_ERROR",
      fallback: false,
    });
  }
});