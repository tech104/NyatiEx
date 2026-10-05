import { useState, useEffect, useCallback } from "react";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import type { NetworkId } from "@/types/exchange";

export interface ElementPayToken {
  address: string;
  symbol: string;
  chain_name: string;
  chain_id: number;
  decimals: number;
  env: string;
}

// Normalize Element Pay chain names across sandbox/testnet and production labels
const normalizeChainName = (chainName: string): string => {
  const normalized = chainName.trim().toLowerCase();

  if (normalized.startsWith("base")) return "Base";
  if (normalized.startsWith("polygon")) return "Polygon";
  if (normalized.startsWith("arbitrum")) return "Arbitrum One";
  if (normalized.startsWith("ethereum")) return "Ethereum";
  if (normalized.startsWith("lisk")) return "Lisk";

  return chainName;
};

// Map Element Pay chain_name → our NetworkId
const CHAIN_NAME_TO_NETWORK: Record<string, NetworkId> = {
  Base: "base",
  Lisk: "lisk",
  Scroll: "scroll",
  Polygon: "polygon",
  "Arbitrum One": "arbitrum-one",
  Ethereum: "ethereum",
};

// Reverse: our NetworkId → Element Pay chain_name
const NETWORK_TO_CHAIN_NAME: Record<string, string> = {
  base: "Base",
  lisk: "Lisk",
  scroll: "Scroll",
  polygon: "Polygon",
  "arbitrum-one": "Arbitrum One",
  ethereum: "Ethereum",
};

export function useElementPayTokens() {
  const [tokens, setTokens] = useState<ElementPayToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/elementpay-meta`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      const data = await res.json();
      if (data.status === "success" && data.data) {
        setTokens(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Get token address by our NetworkId and symbol
  const getTokenAddress = useCallback(
    (network: NetworkId, symbol = "USDT"): string | null => {
      const chainName = NETWORK_TO_CHAIN_NAME[network];
      if (!chainName) return null;

      const token = tokens.find(
        (t) =>
          normalizeChainName(t.chain_name) === chainName &&
          t.symbol?.toUpperCase() === symbol.toUpperCase()
      );
      return token?.address || null;
    },
    [tokens]
  );

  // Get all available tokens for a network
  const getAvailableTokens = useCallback(
    (network: NetworkId): ElementPayToken[] => {
      const chainName = NETWORK_TO_CHAIN_NAME[network];
      if (!chainName) return [];

      return tokens.filter(
        (t) =>
          normalizeChainName(t.chain_name) === chainName &&
          ["USDT", "USDC"].includes(t.symbol?.toUpperCase())
      );
    },
    [tokens]
  );

  return { tokens, loading, error, getTokenAddress, getAvailableTokens, refetch: fetchTokens };
}
