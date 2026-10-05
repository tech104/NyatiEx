import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { SUPPORTED_CHAINS, RPC_URLS, type SupportedChainId } from "@/config/wagmi";

// Public identifier — safe to commit. Rotate via cloud.reown.com if needed.
const WALLETCONNECT_PROJECT_ID = "a0ccd89228b9e119659db599f7d944f8";

export const WALLETCONNECT_OPTION_ID = "walletconnect-mobile-qr";

let providerPromise: Promise<Awaited<ReturnType<typeof EthereumProvider.init>>> | null = null;

export async function getWalletConnectProvider() {
  if (!providerPromise) {
    const chainIds = SUPPORTED_CHAINS.map((c) => c.id) as SupportedChainId[];
    const [requiredChain, ...optionalChainIds] = chainIds;

    const rpcMap: Record<number, string> = {};
    for (const id of chainIds) {
      const rpc = RPC_URLS[id]?.[0];
      if (rpc) rpcMap[id] = rpc;
    }

    try {
      providerPromise = EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        // IMPORTANT: chains and optionalChains MUST NOT overlap.
        chains: [requiredChain],
        optionalChains: optionalChainIds.length
          ? (optionalChainIds as unknown as [number, ...number[]])
          : undefined,
        rpcMap,
        showQrModal: true,
        qrModalOptions: {
          themeMode: "light",
        },
        metadata: {
          name: "Nyati Exchange",
          description: "Sell USDT for KES on M-Pesa instantly",
          url: typeof window !== "undefined" ? window.location.origin : "https://nyati.exchange",
          icons: [
            typeof window !== "undefined"
              ? `${window.location.origin}/favicon.ico`
              : "https://nyati.exchange/favicon.ico",
          ],
        },
      });
      // If init itself fails later, clear the cache so the next attempt retries.
      providerPromise.catch(() => {
        providerPromise = null;
      });
    } catch (error) {
      providerPromise = null;
      throw error;
    }
  }
  return providerPromise;
}

export async function resetWalletConnectProvider() {
  if (!providerPromise) return;
  try {
    const provider = await providerPromise;
    await provider.disconnect().catch(() => undefined);
  } finally {
    providerPromise = null;
  }
}
