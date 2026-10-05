import { useState, useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY, supabase } from "@/integrations/supabase/client";
import type { TransactionStatus } from "@/types/exchange";

export type OnrampStep = "input" | "confirming" | "processing" | "complete" | "failed";

interface OnrampState {
  step: OnrampStep;
  reference: string | null;
  txHash: string | null;
  rateUsed: number | null;
  amountSent: number | null;
  fiatPaid: number | null;
  error: string | null;
  txStatus: TransactionStatus | null;
  isSandbox: boolean;
  /** True only after the edge function has confirmed provider settlement. */
  providerVerifiedSettled: boolean;
}

interface TransactionSnapshot {
  reference: string;
  status: TransactionStatus;
  paycrest_order_id: string | null;
  amount_usdt: number | string | null;
  amount_kes: number | string | null;
  rate_used: number | string | null;
  receive_address: string | null;
  network: string | null;
}

interface StatusResponse {
  status?: string;
  version?: string;
  data?: {
    transaction?: TransactionSnapshot;
    provider?: {
      checked?: boolean;
      status?: TransactionStatus | null;
      rawStatus?: string | null;
      mappedFrom?: string | null;
      raw?: unknown;
    };
  };
}

const initialState: OnrampState = {
  step: "input",
  reference: null,
  txHash: null,
  rateUsed: null,
  amountSent: null,
  fiatPaid: null,
  error: null,
  txStatus: null,
  isSandbox: false,
  providerVerifiedSettled: false,
};

const FAILURE_STATUSES: TransactionStatus[] = ["expired", "refunded"];

const isFailureStatus = (status: TransactionStatus | null | undefined) =>
  !!status && FAILURE_STATUSES.includes(status);

const toNumberOrNull = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getStatusError = (status: TransactionStatus) => {
  if (status === "expired") return "This purchase was cancelled or expired before settlement.";
  if (status === "refunded") return "This purchase was refunded and could not be completed.";
  return null;
};

const PROVIDER_STATUS_MAP: Record<string, TransactionStatus> = {
  pending: "pending",
  submitted: "pending",
  submitted_to_provider: "pending",
  provider_submitted: "pending",
  new: "pending",
  created: "pending",
  awaiting_payment: "pending",
  awaiting_user: "pending",
  processing: "processing",
  in_progress: "processing",
  validated: "validated",
  confirmed: "validated",
  settled: "settled",
  completed: "settled",
  complete: "settled",
  fulfilled: "settled",
  paid: "settled",
  failed: "expired",
  failure: "expired",
  cancelled: "expired",
  canceled: "expired",
  expired: "expired",
  rejected: "expired",
  error: "expired",
  refunded: "refunded",
  reversed: "refunded",
};

const mapProviderStatus = (value: unknown): TransactionStatus | null => {
  if (typeof value !== "string") return null;
  return PROVIDER_STATUS_MAP[value.toLowerCase().trim()] ?? null;
};

const extractProviderStatusFromRaw = (
  payload: unknown
): { status: TransactionStatus | null; rawStatus: string | null; mappedFrom: string | null } => {
  if (!payload || typeof payload !== "object") {
    return { status: null, rawStatus: null, mappedFrom: null };
  }

  const root = payload as Record<string, unknown>;
  const candidates: Array<{ value: unknown; path: string }> = [];

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

  const rootOrder = root.order;
  if (rootOrder && typeof rootOrder === "object") {
    const orderObj = rootOrder as Record<string, unknown>;
    candidates.push({ value: orderObj.status, path: "order.status" });
    candidates.push({ value: orderObj.order_status, path: "order.order_status" });
  }

  for (const candidate of candidates) {
    if (typeof candidate.value !== "string") continue;
    const status = mapProviderStatus(candidate.value);
    if (status) {
      return { status, rawStatus: candidate.value, mappedFrom: candidate.path };
    }
  }

  return { status: null, rawStatus: null, mappedFrom: null };
};

/**
 * Compute the next UI step.
 * IMPORTANT: never return "complete" purely from a DB snapshot; only the
 * checkStatusNow flow can flip to "complete" once the edge function has
 * verified provider settlement.
 */
const stepFromSnapshot = (status: TransactionStatus, currentStep: OnrampStep): OnrampStep => {
  if (status === "expired" || status === "refunded") return "failed";
  if (status === "pending" || status === "processing" || status === "validated" || status === "settled") {
    // Stay in processing for `settled` until provider verification flips us.
    if (currentStep === "complete" || currentStep === "failed") return currentStep;
    return "processing";
  }
  return currentStep;
};

const mergeSnapshot = (prev: OnrampState, snapshot: TransactionSnapshot): OnrampState => {
  // Lock terminal UI states (complete / failed) from being overwritten.
  if (prev.step === "complete" || prev.step === "failed") {
    // Still allow updating numeric receipt fields if missing.
    return {
      ...prev,
      txHash: prev.txHash ?? snapshot.paycrest_order_id ?? null,
      rateUsed: prev.rateUsed ?? toNumberOrNull(snapshot.rate_used),
      amountSent: prev.amountSent ?? toNumberOrNull(snapshot.amount_usdt),
      fiatPaid: prev.fiatPaid ?? toNumberOrNull(snapshot.amount_kes),
    };
  }

  if (prev.reference && snapshot.reference && prev.reference !== snapshot.reference) {
    return prev;
  }

  return {
    ...prev,
    step: stepFromSnapshot(snapshot.status, prev.step),
    txStatus: snapshot.status,
    reference: snapshot.reference ?? prev.reference,
    txHash: snapshot.paycrest_order_id ?? prev.txHash,
    rateUsed: toNumberOrNull(snapshot.rate_used) ?? prev.rateUsed,
    amountSent: toNumberOrNull(snapshot.amount_usdt) ?? prev.amountSent,
    fiatPaid: toNumberOrNull(snapshot.amount_kes) ?? prev.fiatPaid,
    error: getStatusError(snapshot.status) ?? prev.error,
  };
};

export function useOnramp() {
  const [state, setState] = useState<OnrampState>(initialState);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<RealtimeChannel | null>(null);

  const stopTracking = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (realtimeRef.current) {
      void supabase.removeChannel(realtimeRef.current);
      realtimeRef.current = null;
    }
  }, []);

  const applySnapshot = useCallback((snapshot: TransactionSnapshot) => {
    setState((prev) => mergeSnapshot(prev, snapshot));
    return snapshot.status;
  }, []);

  /**
   * Authoritative success/failure transition driven by the edge function.
   * This is the ONLY path that can set step="complete".
   */
  const applyVerifiedResult = useCallback(
    (params: {
      providerStatus: TransactionStatus | null;
      providerChecked: boolean;
      latest: TransactionSnapshot | null;
    }) => {
      const { providerStatus, providerChecked, latest } = params;

      setState((prev) => {
        if (prev.step === "complete" || prev.step === "failed") return prev;

        // Pull through latest receipt details if we have them.
        const base = latest ? mergeSnapshot(prev, latest) : prev;

        // Failure path: provider OR DB explicitly reports terminal failure.
        if (isFailureStatus(providerStatus) || isFailureStatus(latest?.status ?? null)) {
          const failStatus: TransactionStatus =
            (isFailureStatus(providerStatus) ? providerStatus : latest?.status) ?? "expired";
          return {
            ...base,
            step: "failed",
            txStatus: failStatus,
            error: getStatusError(failStatus) ?? "Purchase could not be completed.",
          };
        }

        // Success path: REQUIRES provider verification of "settled".
        if (providerChecked && providerStatus === "settled") {
          return {
            ...base,
            step: "complete",
            txStatus: "settled",
            providerVerifiedSettled: true,
            error: null,
          };
        }

        // Otherwise stay in processing, even if DB row says "settled".
        return {
          ...base,
          step: "processing",
          txStatus: providerStatus ?? base.txStatus,
        };
      });

      // Stop tracking on any terminal outcome.
      const terminal =
        (providerChecked && providerStatus === "settled") ||
        isFailureStatus(providerStatus) ||
        isFailureStatus(latest?.status ?? null);
      if (terminal) stopTracking();
    },
    [stopTracking]
  );

  const createBuyOrder = useCallback(
    async (params: {
      amountFiat: number;
      phoneNumber: string;
      walletAddress: string;
      token: string;
      network: string;
      /** Full customer identity block required by the KE corridor. */
      customerName?: string;
      customerEmail?: string;
      customerDob?: string; // mm/dd/yyyy
      customerIdNumber?: string;
      customerIdType?: string;
      customerAddress?: string;
    }) => {
      setState((prev) => ({ ...prev, step: "confirming", error: null, providerVerifiedSettled: false }));

      try {
        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-onramp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            amountFiat: params.amountFiat,
            phoneNumber: params.phoneNumber,
            walletAddress: params.walletAddress,
            token: params.token,
            network: params.network,
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            customerDob: params.customerDob,
            customerIdNumber: params.customerIdNumber,
            customerIdType: params.customerIdType,
            customerAddress: params.customerAddress,
          }),
        });


        const result = await res.json();

        if (!res.ok || result.status !== "success") {
          const detail =
            result.error ||
            result.details?.message ||
            result.details?.data ||
            JSON.stringify(result.details) ||
            "Failed to create buy order";
          throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        }

        const data = result.data;
        const sandboxDetected = data.sandbox === true || data.environment === "sandbox";

        setState({
          step: "processing",
          reference: data.reference,
          txHash: data.txHash,
          rateUsed: data.rateUsed,
          amountSent: data.amountSent,
          fiatPaid: data.fiatPaid,
          error: null,
          txStatus: "pending",
          isSandbox: sandboxDetected,
          providerVerifiedSettled: false,
        });

        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to create buy order";
        const isSandboxError = errorMsg.includes("API key not configured") || errorMsg.includes("sandbox");

        setState({
          ...initialState,
          step: "failed",
          error: errorMsg,
          isSandbox: isSandboxError,
        });
        return null;
      }
    },
    []
  );

  const simulateComplete = useCallback(() => {
    // Sandbox-only convenience. We mark it as provider-verified so the UI
    // can leave processing, but only the explicit user action triggers it.
    setState((prev) => ({
      ...prev,
      step: "complete",
      txStatus: "settled",
      providerVerifiedSettled: true,
      amountSent: prev.amountSent ?? (prev.fiatPaid && prev.rateUsed ? prev.fiatPaid / prev.rateUsed : 0),
    }));
    stopTracking();
  }, [stopTracking]);

  const checkStatusNow = useCallback(
    async (reference: string) => {
      try {
        // 1. Pull DB snapshot for receipt fields, but never trust a local "settled".
        const { data: dbRow } = await supabase
          .from("transactions")
          .select("reference,status,paycrest_order_id,amount_usdt,amount_kes,rate_used,receive_address,network")
          .eq("reference", reference)
          .maybeSingle();

        const dbSnapshot = dbRow as TransactionSnapshot | null;
        if (dbSnapshot && dbSnapshot.status !== "settled") {
          applySnapshot(dbSnapshot);
        }

        // Failure can be trusted from the DB.
        if (dbSnapshot && isFailureStatus(dbSnapshot.status)) {
          applyVerifiedResult({
            providerStatus: dbSnapshot.status,
            providerChecked: false,
            latest: dbSnapshot,
          });
          return dbSnapshot.status;
        }

        // 2. Ask the edge function for the verified provider status.
        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-order-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ reference }),
        });

        const result = (await res.json()) as StatusResponse;
        const latest = (result?.data?.transaction as TransactionSnapshot | undefined) ?? null;
        const provider = result?.data?.provider;
        const responseProviderStatus = (provider?.status as TransactionStatus | null | undefined) ?? null;
        const rawProvider = extractProviderStatusFromRaw(provider?.raw);
        const providerStatus = rawProvider.status
          ?? (responseProviderStatus && responseProviderStatus !== "settled" ? responseProviderStatus : null);
        const providerChecked = result?.data?.provider?.checked === true;

        if (!res.ok || result?.status !== "success") {
          // Edge function failed; do not flip to success on its own.
          if (dbSnapshot && dbSnapshot.status !== "settled") {
            applySnapshot(dbSnapshot);
          }
          return dbSnapshot?.status ?? null;
        }

        applyVerifiedResult({
          providerStatus,
          providerChecked,
          latest,
        });

        // Return the most authoritative status we know about.
        if (providerChecked && providerStatus) return providerStatus;
        return latest?.status ?? dbSnapshot?.status ?? null;
      } catch {
        return null;
      }
    },
    [applySnapshot, applyVerifiedResult]
  );

  const startPolling = useCallback(
    (reference: string) => {
      stopTracking();

      realtimeRef.current = supabase
        .channel(`onramp:${reference}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "transactions",
            filter: `reference=eq.${reference}`,
          },
          (payload) => {
            const snapshot = payload.new as TransactionSnapshot;

            // Always re-verify with the edge function on any change. We never
            // promote the UI to "complete" purely from a realtime DB event.
            void checkStatusNow(reference);

            // For non-settled, non-terminal updates, reflect intermediate
            // info immediately (e.g. amount_usdt fills in).
            if (snapshot.status !== "settled" && !isFailureStatus(snapshot.status)) {
              applySnapshot(snapshot);
            }
          }
        )
        .subscribe();

      void checkStatusNow(reference);
      pollingRef.current = setInterval(() => {
        void checkStatusNow(reference);
      }, 3000);
    },
    [applySnapshot, checkStatusNow, stopTracking]
  );

  const reset = useCallback(() => {
    stopTracking();
    setState(initialState);
  }, [stopTracking]);

  useEffect(() => stopTracking, [stopTracking]);

  return {
    ...state,
    createBuyOrder,
    startPolling,
    checkStatusNow,
    simulateComplete,
    reset,
  };
}
