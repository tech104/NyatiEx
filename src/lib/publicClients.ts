import { createPublicClient, fallback, http } from "viem";
import { CHAIN_BY_ID, RPC_URLS, type SupportedChainId } from "@/config/wagmi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clients = new Map<SupportedChainId, any>();

export function getPublicClientForChain(chainId: SupportedChainId) {
  const existing = clients.get(chainId);
  if (existing) return existing;

  const client = createPublicClient({
    chain: CHAIN_BY_ID[chainId],
    transport: fallback(
      RPC_URLS[chainId].map((url) => http(url, { timeout: 10_000, retryCount: 2, retryDelay: 300 })),
      { rank: false, retryCount: 1 }
    ),
  });

  clients.set(chainId, client);
  return client;
}
