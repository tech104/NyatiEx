import { useState, useCallback, useEffect, useRef } from "react";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
import type { NetworkId, OfframpOrderResponse, TransactionStatus } from "@/types/exchange";

export type OfframpStep =
  | "input"
  | "switching-chain"
  | "approving"
  | "confirming"
  | "deposit"
  | "processing"
  | "complete"
  | "failed";

interface OfframpState {
  step: OfframpStep;
  order: OfframpOrderResponse | null;
  error: string | null;
  txStatus: TransactionStatus | null;
}

export interface OfframpCreateOrderError {
  message: string;
  code?: string;
  debug?: unknown;
  /**
   * Element Pay quote id, returned even on failure so a retry can resume the
   * SAME order instead of creating a second one for one wallet approval.
   */
  quoteId?: string;
}

export interface OfframpCreateOrderResult {
  order: OfframpOrderResponse | null;
  error: OfframpCreateOrderError | null;
}

/**
 * Ask the provider (via the order-status function) whether an order already
 * exists for this client reference. Used after a network failure so a retry
 * never creates a second Element Pay order for one wallet approval.
 */
async function lookupExistingOrder(reference: string): Promise<OfframpOrderResponse | null> {
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-order-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ reference }),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const tx = payload?.data?.transaction;
    const provider = payload?.data?.provider;
    const orderId = tx?.paycrest_order_id ?? null;
    if (!orderId || String(orderId).startsWith("QUOTE:")) return null;
    return {
      id: String(orderId),
      reference,
      status: (provider?.status ?? tx?.status ?? "pending") as string,
      txHash: String(orderId),
      rateUsed: tx?.rate_used ?? undefined,
      amountSent: tx?.amount_usdt ?? undefined,
      fiatPaid: tx?.amount_kes ?? undefined,
    } as OfframpOrderResponse;
  } catch {
    return null;
  }
}

export function useOfframp() {

  const [state, setState] = useState<OfframpState>({
    step: "input",
    order: null,
    error: null,
    txStatus: null,
  });

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStep = useCallback((step: OfframpStep) => {
    setState((prev) => ({ ...prev, step, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, step: "failed", error }));
  }, []);

  const createOrder = useCallback(
    async (params: {
      amountFiat: number;
      amountToken?: string; // base-units string (e.g., "1000000" for 1 USDC)
      tokenDecimals?: number;
      clientRef?: string;
      /** Reuse an existing Element Pay quote instead of creating a new order. */
      resumeQuoteId?: string;
      network: NetworkId;
      phoneNumber: string;
      recipientName: string;
      institution?: string;
      userAddress: string;
      token: string; // ERC20 contract address
      /** Full customer identity block required by the KE corridor. */
      customerName?: string;
      customerEmail?: string;
      customerDob?: string; // mm/dd/yyyy
      customerIdNumber?: string;
      customerIdType?: string;
      customerAddress?: string;
    }) => {
      setState((prev) => ({ ...prev, step: "confirming", error: null }));

      const body = JSON.stringify({
        amountFiat: params.amountFiat,
        amountToken: params.amountToken,
        tokenDecimals: params.tokenDecimals,
        clientRef: params.clientRef,
        resumeQuoteId: params.resumeQuoteId,
        cashoutType: params.institution || "PHONE",
        phoneNumber: params.phoneNumber.replace(/^\+/, ""),
        recipientName: params.recipientName,
        network: params.network,
        userAddress: params.userAddress,
        token: params.token,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerDob: params.customerDob,
        customerIdNumber: params.customerIdNumber,
        customerIdType: params.customerIdType,
        customerAddress: params.customerAddress,
      });


      // Retry transient network failures (e.g. "Failed to fetch") up to 3 times
      // with backoff. This is critical post-approval: the on-chain approve
      // succeeded, so we must not show "Order Failed" because of one flaky fetch.
      const maxAttempts = 3;
      let lastFetchError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-offramp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body,
          });

          const result = await res.json();

          if (!res.ok || result.status === "error" || result.error) {
            const errorMessage = typeof result.error === "string" ? result.error : "Failed to create order";
            const nextError = {
              message: errorMessage,
              code: typeof result.code === "string" ? result.code : undefined,
              debug: result.debug,
              quoteId:
                typeof result.quoteId === "string"
                  ? result.quoteId
                  : typeof result.debug?.quoteId === "string"
                    ? result.debug.quoteId
                    : undefined,
            } satisfies OfframpCreateOrderError;


            setState({
              step: "failed",
              order: null,
              error: nextError.message,
              txStatus: null,
            });

            return { order: null, error: nextError } satisfies OfframpCreateOrderResult;
          }

          setState({
            step: "processing",
            order: result.data,
            error: null,
            txStatus: "pending",
          });

          return { order: result.data, error: null } satisfies OfframpCreateOrderResult;
        } catch (err) {
          // Network-level failure (e.g. "Failed to fetch", DNS, dropped
          // connection). The request may still have created an order upstream,
          // so NEVER blindly re-POST: ask for the order first and adopt it if
          // it exists. Only re-POST when the provider has nothing for us.
          lastFetchError = err;

          if (params.clientRef) {
            const existing = await lookupExistingOrder(params.clientRef);
            if (existing) {
              setState({ step: "processing", order: existing, error: null, txStatus: "pending" });
              return { order: existing, error: null } satisfies OfframpCreateOrderResult;
            }
          }

          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 800 * attempt));
            continue;
          }
        }

      }

      const fallbackMessage =
        lastFetchError instanceof Error
          ? `Could not reach Element Pay (${lastFetchError.message}). Nothing has left your wallet — tap Retry.`
          : "Could not reach Element Pay. Nothing has left your wallet — tap Retry.";

      setState({
        step: "failed",
        order: null,
        error: fallbackMessage,
        txStatus: null,
      });
      return {
        order: null,
        error: { message: fallbackMessage, code: "NETWORK_ERROR" },
      } satisfies OfframpCreateOrderResult;
    },
    []
  );

  /**
   * Bind the user's on-chain transfer to the Element Pay order. The function
   * re-checks the transfer on-chain (owner -> the order's deposit address,
   * exact amount) before accepting it.
   */
  const confirmSettlement = useCallback(
    async (params: { reference: string; txHash: string; token: string }) => {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-offramp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "settlement", ...params }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status === "error") {
        const message = typeof result.error === "string" ? result.error : "Could not confirm your transfer";
        return { ok: false as const, error: message };
      }
      setState((prev) => ({ ...prev, step: "processing", txStatus: "processing" }));
      return { ok: true as const, error: null };
    },
    []
  );

  // Poll for status updates. The webhook is the primary signal; if it is late
  // we fall back to asking Element Pay directly via the order-status function
  // so a real payout is never stuck on "Processing" forever.
  const startPolling = useCallback((reference: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const startedAt = Date.now();

    const applyStatus = (status: TransactionStatus) => {
      setState((prev) => {
        if (prev.txStatus === status) return prev;

        let step: OfframpStep = prev.step;
        if (status === "validated" || status === "settled") step = "complete";
        else if (status === "expired" || status === "refunded") step = "failed";
        else if (status === "processing") step = "processing";

        return { ...prev, txStatus: status, step };
      });

      if (["validated", "settled", "expired", "refunded"].includes(status)) {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("status")
          .eq("reference", reference)
          .maybeSingle();

        const status = (!error && data ? data.status : null) as TransactionStatus | null;
        if (status) applyStatus(status);

        // Webhook still hasn't moved the row after ~30s → ask the provider.
        const stale = !status || status === "pending";
        if (stale && Date.now() - startedAt > 30000) {
          const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-order-status`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ reference }),
          });
          const payload = await res.json();
          const providerStatus = payload?.data?.provider?.status as TransactionStatus | null;
          const dbStatus = payload?.data?.transaction?.status as TransactionStatus | null;
          const resolved = providerStatus ?? dbStatus;
          if (resolved) applyStatus(resolved);
        }
      } catch {
        // Silently retry
      }
    }, 10000);
  }, []);

  const reset = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setState({ step: "input", order: null, error: null, txStatus: null });
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return {
    ...state,
    createOrder,
    confirmSettlement,
    startPolling,
    reset,
    setStep,
    setError,
  };
}
