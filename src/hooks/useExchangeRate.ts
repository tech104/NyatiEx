import { useState, useEffect, useCallback, useRef } from "react";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import type { NetworkId } from "@/types/exchange";

const REFRESH_INTERVAL = 30; // seconds

interface RateData {
  marketRate: number;
  effectiveRate: number;
  feePercent: number;
  token: string;
  currency: string;
  amount: number;
  estimatedPayout: number;
}

export function useExchangeRate(amount: number, network: NetworkId) {
  const [rate, setRate] = useState<RateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetCountdown = useCallback(() => {
    setCountdown(REFRESH_INTERVAL);
  }, []);

  const fetchRate = useCallback(async () => {
    if (amount < 0.5) {
      setRate(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/elementpay-rates?amount=${amount}&token=USDC&currency=KES`,
        {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data?.error || "Failed to fetch rate");
      }
      setRate(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rate");
    } finally {
      setLoading(false);
      resetCountdown();
    }
  }, [amount, network, resetCountdown]);

  // Countdown ticker
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL;
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Fetch on countdown reaching 0
  useEffect(() => {
    if (countdown === 0) {
      fetchRate();
    }
  }, [countdown, fetchRate]);

  // Fetch on amount/network change
  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const refetch = useCallback(() => {
    fetchRate();
  }, [fetchRate]);

  return { rate, loading, error, refetch, countdown, refreshInterval: REFRESH_INTERVAL };
}
