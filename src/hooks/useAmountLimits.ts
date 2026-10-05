import { useEffect, useState } from "react";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

export interface AmountLimit {
  min: number;
  max: number;
  currency: string;
}

export interface AmountLimits {
  buy: AmountLimit;
  sell: AmountLimit;
  source: "catalog" | "fallback";
}

/**
 * Operator-configured fallbacks. Used until (and if) Element Pay's catalog
 * reports its own per-rail limits.
 */
export const FALLBACK_AMOUNT_LIMITS: AmountLimits = {
  buy: { min: 10, max: 450000, currency: "KES" },
  sell: { min: 1, max: 4000, currency: "USD" },
  source: "fallback",
};

let cached: AmountLimits | null = null;
let inFlight: Promise<AmountLimits> | null = null;

async function fetchLimits(): Promise<AmountLimits> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-limits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: "{}",
      });
      const body = await res.json();
      const data = body?.data;
      if (
        data &&
        typeof data.buy?.min === "number" &&
        typeof data.buy?.max === "number" &&
        typeof data.sell?.min === "number" &&
        typeof data.sell?.max === "number"
      ) {
        cached = {
          buy: { min: data.buy.min, max: data.buy.max, currency: data.buy.currency ?? "KES" },
          sell: { min: data.sell.min, max: data.sell.max, currency: data.sell.currency ?? "USD" },
          source: data.source === "catalog" ? "catalog" : "fallback",
        };
        return cached;
      }
    } catch {
      // fall through to defaults
    }
    return FALLBACK_AMOUNT_LIMITS;
  })();

  const result = await inFlight;
  inFlight = null;
  return result;
}

/** Resolved min/max for a direction, with provider values when available. */
export function useAmountLimits(direction: "buy" | "sell") {
  const [limits, setLimits] = useState<AmountLimits>(cached ?? FALLBACK_AMOUNT_LIMITS);

  useEffect(() => {
    let active = true;
    fetchLimits().then((value) => {
      if (active) setLimits(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const limit = direction === "buy" ? limits.buy : limits.sell;

  return {
    min: limit.min,
    max: limit.max,
    currency: limit.currency,
    source: limits.source,
  };
}

export function formatLimitAmount(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
}
