import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { CHAIN_BY_ID, RPC_URLS, type SupportedChainId } from "@/config/wagmi";
import { getWalletConnectProvider, resetWalletConnectProvider, WALLETCONNECT_OPTION_ID } from "@/lib/walletconnect";

export type WalletProvider = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  providers?: WalletProvider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  isCore?: boolean;
};

type Eip6963ProviderInfo = {
  name: string;
  icon?: string;
  rdns: string;
};

type Eip6963AnnounceDetail = {
  info: Eip6963ProviderInfo;
  provider: WalletProvider;
};

declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<Eip6963AnnounceDetail>;
  }
  interface Window {
    ethereum?: any;
  }
}

export type WalletSessionState = "disconnected" | "checking" | "active" | "locked" | "stale";

export type WalletOption = {
  id: string;
  name: string;
  provider: WalletProvider | null;
  source: "legacy" | "eip6963" | "walletconnect";
};

type RefreshResult = {
  address: string | null;
  chainId: number | null;
  provider: WalletProvider | null;
  state: WalletSessionState;
};

type WalletSessionContextValue = {
  address: string | null;
  availableWallets: WalletOption[];
  chainId: number | null;
  connectWallet: (walletId: string) => Promise<RefreshResult>;
  disconnectWallet: () => Promise<void>;
  ensureWalletAccess: (activeProvider?: WalletProvider | null, walletLabel?: string | null) => Promise<string[]>;
  hasActiveSession: boolean;
  isConnected: boolean;
  provider: WalletProvider | null;
  refreshSession: () => Promise<RefreshResult>;
  sessionState: WalletSessionState;
  switchChain: (chainId: SupportedChainId, activeProvider?: WalletProvider | null) => Promise<void>;
  waitForActiveSession: (options?: { timeoutMs?: number; pollMs?: number }) => Promise<RefreshResult>;
  walletName: string | null;
};

const WalletSessionContext = createContext<WalletSessionContextValue | null>(null);

const PRIORITY_BY_NAME: Record<string, number> = {
  MetaMask: 0,
  Rabby: 1,
  "Coinbase Wallet": 2,
  Coinbase: 2,
  Core: 3,
  "Trust Wallet": 4,
  "Browser Wallet": 90,
};

const parseChainId = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    return value.startsWith("0x") ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
  }
  return null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getInjectedEthereum = (): WalletProvider | undefined => {
  return (window as typeof window & { ethereum?: WalletProvider }).ethereum;
};

const normalizeWalletName = (fallbackName: string | undefined, provider?: WalletProvider) => {
  const rawName = fallbackName?.trim();
  if (rawName) {
    if (/metamask/i.test(rawName)) return "MetaMask";
    if (/rabby/i.test(rawName)) return "Rabby";
    if (/coinbase/i.test(rawName)) return "Coinbase Wallet";
    if (/trust/i.test(rawName)) return "Trust Wallet";
    if (/core/i.test(rawName)) return "Core";
    return rawName;
  }

  if (provider?.isRabby) return "Rabby";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isTrust) return "Trust Wallet";
  if (provider?.isCore) return "Core";
  if (provider?.isMetaMask) return "MetaMask";
  return "Browser Wallet";
};

const buildWalletId = (name: string, rdns?: string) =>
  `${(rdns || name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const dedupeWallets = (wallets: WalletOption[]) => {
  const unique = new Map<string, WalletOption>();

  for (const wallet of wallets) {
    const key = wallet.name.toLowerCase();
    const existing = unique.get(key);

    if (!existing || (existing.source === "legacy" && wallet.source === "eip6963")) {
      unique.set(key, wallet);
    }
  }

  return [...unique.values()].sort((a, b) => {
    const aPriority = PRIORITY_BY_NAME[a.name] ?? 50;
    const bPriority = PRIORITY_BY_NAME[b.name] ?? 50;
    return aPriority - bPriority || a.name.localeCompare(b.name);
  });
};

export function WalletSessionProvider({ children }: PropsWithChildren) {
  const [availableWallets, setAvailableWallets] = useState<WalletOption[]>([]);
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<WalletSessionState>("disconnected");
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const providerRef = useRef<WalletProvider | null>(null);
  const addressRef = useRef<string | null>(null);
  const chainIdRef = useRef<number | null>(null);
  const walletNameRef = useRef<string | null>(null);
  const sessionStateRef = useRef<WalletSessionState>("disconnected");

  const clearListeners = useCallback(() => {
    listenerCleanupRef.current?.();
    listenerCleanupRef.current = null;
  }, []);

  const disconnectWallet = useCallback(async () => {
    clearListeners();
    const wasWalletConnect = walletNameRef.current === "WalletConnect";
    providerRef.current = null;
    walletNameRef.current = null;
    addressRef.current = null;
    chainIdRef.current = null;
    sessionStateRef.current = "disconnected";
    setProvider(null);
    setWalletName(null);
    setAddress(null);
    setChainId(null);
    setSessionState("disconnected");
    if (wasWalletConnect) {
      await resetWalletConnectProvider().catch(() => undefined);
    }
  }, [clearListeners]);

  const attachProviderListeners = useCallback(
    (nextProvider: WalletProvider) => {
      clearListeners();

      const handleAccountsChanged = (nextAccounts: unknown) => {
        const accounts = Array.isArray(nextAccounts)
          ? nextAccounts.filter((account): account is string => typeof account === "string")
          : [];

        if (accounts.length === 0) {
          addressRef.current = null;
          sessionStateRef.current = "locked";
          setAddress(null);
          setSessionState("locked");
          return;
        }

        addressRef.current = accounts[0];
        sessionStateRef.current = "active";
        setAddress(accounts[0]);
        setSessionState("active");
      };

      const handleChainChanged = (nextChainId: unknown) => {
        const parsed = parseChainId(nextChainId);
        chainIdRef.current = parsed;
        setChainId(parsed);
      };

      const handleDisconnect = () => {
        void disconnectWallet();
      };

      nextProvider.on?.("accountsChanged", handleAccountsChanged);
      nextProvider.on?.("chainChanged", handleChainChanged);
      nextProvider.on?.("disconnect", handleDisconnect);

      listenerCleanupRef.current = () => {
        nextProvider.removeListener?.("accountsChanged", handleAccountsChanged);
        nextProvider.removeListener?.("chainChanged", handleChainChanged);
        nextProvider.removeListener?.("disconnect", handleDisconnect);
      };
    },
    [clearListeners, disconnectWallet]
  );

  const setConnectedState = useCallback(
    (nextProvider: WalletProvider, nextWalletName: string, nextAddress: string, nextChainId: number | null) => {
      providerRef.current = nextProvider;
      walletNameRef.current = nextWalletName;
      addressRef.current = nextAddress;
      chainIdRef.current = nextChainId;
      sessionStateRef.current = "active";
      setProvider(nextProvider);
      setWalletName(nextWalletName);
      setAddress(nextAddress);
      setChainId(nextChainId);
      setSessionState("active");
      attachProviderListeners(nextProvider);
    },
    [attachProviderListeners]
  );

  const ensureWalletAccess = useCallback(
    async (activeProvider = providerRef.current, walletLabel = walletNameRef.current): Promise<string[]> => {
      if (!activeProvider?.request) {
        throw new Error("Wallet connection is not available in this browser.");
      }

      try {
        const accounts = await activeProvider.request({ method: "eth_requestAccounts" });
        const accountList = Array.isArray(accounts)
          ? accounts.filter((account): account is string => typeof account === "string")
          : [];

        if (accountList.length === 0) {
          throw new Error("Wallet connection did not finish in the extension. Open the wallet and approve the connection.");
        }

        const nextChainHex = await activeProvider.request({ method: "eth_chainId" }).catch(() => null);
        const nextChainId = parseChainId(nextChainHex);
        setConnectedState(
          activeProvider,
          walletLabel || normalizeWalletName(undefined, activeProvider),
          accountList[0],
          nextChainId
        );

        return accountList;
      } catch (error) {
        const errorCode =
          typeof error === "object" && error && "code" in error
            ? Number((error as { code?: unknown }).code)
            : undefined;
        const errorMessage = error instanceof Error ? error.message : "";

        if (errorCode === 4001 || /User rejected|User denied|denied/i.test(errorMessage)) {
          throw error;
        }

        if (errorCode === -32002 || /Already processing eth_requestAccounts/i.test(errorMessage)) {
          throw new Error("Finish the open MetaMask connection prompt, then try again.");
        }

        throw error;
      }
    },
    [setConnectedState]
  );

  const refreshSession = useCallback(async (): Promise<RefreshResult> => {
    const activeProvider = providerRef.current;
    const activeAddress = addressRef.current;
    const currentChainId = chainIdRef.current;

    if (!activeProvider?.request) {
      sessionStateRef.current = "disconnected";
      setSessionState("disconnected");
      return { address: null, chainId: null, provider: null, state: "disconnected" };
    }

    if (!activeAddress) {
      const nextChainId = parseChainId(await activeProvider.request({ method: "eth_chainId" }).catch(() => null));
      chainIdRef.current = nextChainId;
      sessionStateRef.current = "locked";
      setChainId(nextChainId);
      setSessionState("locked");
      return { address: null, chainId: nextChainId, provider: null, state: "locked" };
    }

    setSessionState((prev) => (prev === "active" ? prev : "checking"));

    try {
      const accounts = await activeProvider.request({ method: "eth_accounts" }).catch(() => []);
      const nextChainHex = await activeProvider.request({ method: "eth_chainId" }).catch(() => null);
      const accountList = Array.isArray(accounts)
        ? accounts.filter((account): account is string => typeof account === "string")
        : [];
      const nextChainId = parseChainId(nextChainHex);
      const hasMatchingAccount = accountList.some((account) => account.toLowerCase() === activeAddress.toLowerCase());
      const nextState: WalletSessionState = hasMatchingAccount
        ? "active"
        : accountList.length === 0
          ? "locked"
          : "stale";

      chainIdRef.current = nextChainId;
      sessionStateRef.current = nextState;
      setChainId(nextChainId);
      setSessionState(nextState);

      return {
        address: hasMatchingAccount ? activeAddress : null,
        chainId: nextChainId,
        provider: hasMatchingAccount ? activeProvider : null,
        state: nextState,
      };
    } catch {
      sessionStateRef.current = "stale";
      setSessionState("stale");
      return { address: activeAddress, chainId: currentChainId, provider: null, state: "stale" };
    }
  }, []);

  const waitForActiveSession = useCallback(
    async ({ timeoutMs = 8000, pollMs = 400 }: { timeoutMs?: number; pollMs?: number } = {}) => {
      let latest: RefreshResult = {
        address: addressRef.current,
        chainId: chainIdRef.current,
        provider: sessionStateRef.current === "active" ? providerRef.current : null,
        state: sessionStateRef.current,
      };

      const deadline = Date.now() + timeoutMs;
      while (Date.now() <= deadline) {
        latest = await refreshSession();
        if (latest.state === "active" && latest.provider) return latest;
        await sleep(pollMs);
      }

      return latest;
    },
    [refreshSession]
  );

  const connectWallet = useCallback(
    async (walletId: string): Promise<RefreshResult> => {
      const selectedWallet = availableWallets.find((wallet) => wallet.id === walletId);
      if (!selectedWallet) {
        throw new Error("Selected wallet is not available.");
      }

      sessionStateRef.current = "checking";
      setSessionState("checking");

      try {
        // WalletConnect branch: lazy-init provider and open QR modal.
        if (selectedWallet.source === "walletconnect") {
          const wc = await getWalletConnectProvider();
          try {
            if (!wc.session) {
              await wc.connect();
            }
          } catch (wcError) {
            // Reset so a retry creates a fresh pairing (otherwise the modal goes blank).
            await resetWalletConnectProvider().catch(() => undefined);
            const msg = wcError instanceof Error ? wcError.message : String(wcError);
            if (/publish|relay|payload/i.test(msg)) {
              throw new Error(
                "WalletConnect could not reach its relay. This usually means the current site origin isn't in the Reown Cloud 'Allowed Domains' list for your Project ID. Add it at cloud.reown.com → your project → Allowed Domains, then retry."
              );
            }
            throw wcError;
          }
          const wcProvider = wc as unknown as WalletProvider;
          const accountList = await ensureWalletAccess(wcProvider, "WalletConnect");
          const nextChainId = parseChainId(
            await wcProvider.request!({ method: "eth_chainId" }).catch(() => null)
          );
          return {
            address: accountList[0],
            chainId: nextChainId,
            provider: wcProvider,
            state: "active",
          };
        }

        if (!selectedWallet.provider?.request) {
          throw new Error("Selected wallet is not available in this browser.");
        }

        const accountList = await ensureWalletAccess(selectedWallet.provider, selectedWallet.name);
        const nextChainId = parseChainId(await selectedWallet.provider.request({ method: "eth_chainId" }).catch(() => null));

        return {
          address: accountList[0],
          chainId: nextChainId,
          provider: selectedWallet.provider,
          state: "active",
        };
      } catch (error) {
        await disconnectWallet();
        throw error;
      }
    },
    [availableWallets, disconnectWallet, ensureWalletAccess]
  );

  const switchChain = useCallback(
    async (targetChainId: SupportedChainId, activeProvider = providerRef.current) => {
      const nextProvider = activeProvider;
      const chain = CHAIN_BY_ID[targetChainId];

      if (!chain || !nextProvider?.request) {
        throw new Error("Wallet is not ready for network switching.");
      }

      const chainHex = `0x${targetChainId.toString(16)}`;

      try {
        await nextProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
      } catch (providerError) {
        const errorCode =
          typeof providerError === "object" && providerError && "code" in providerError
            ? Number((providerError as { code?: unknown }).code)
            : undefined;

        if (errorCode !== 4902) throw providerError;

        await nextProvider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: chainHex,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: RPC_URLS[targetChainId],
            blockExplorerUrls: chain.blockExplorers?.default?.url ? [chain.blockExplorers.default.url] : undefined,
          }],
        });

        await nextProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const activeChainId = parseChainId(await nextProvider.request({ method: "eth_chainId" }).catch(() => null));
        if (activeChainId === targetChainId) {
          chainIdRef.current = activeChainId;
          setChainId(activeChainId);
          return;
        }
        await sleep(500);
      }

      throw new Error("Your wallet did not finish switching networks. Confirm the switch in your wallet and try again.");
    },
    []
  );

  useEffect(() => {
    const registerWallet = (nextProvider: WalletProvider, info?: Eip6963ProviderInfo) => {
      if (!nextProvider || typeof nextProvider !== "object") return;

      const source: WalletOption["source"] = info ? "eip6963" : "legacy";
      const name = normalizeWalletName(info?.name, nextProvider);

      setAvailableWallets((current) =>
        dedupeWallets([
          ...current.filter((wallet) => wallet.provider !== nextProvider),
          { id: buildWalletId(name, info?.rdns), name, provider: nextProvider, source },
        ])
      );
    };

    const handleProviderAnnouncement = (event: CustomEvent<Eip6963AnnounceDetail>) => {
      registerWallet(event.detail.provider, event.detail.info);
    };

    const ethereum = getInjectedEthereum();
    const legacyProviders = Array.isArray(ethereum?.providers) && ethereum.providers.length > 0
      ? ethereum.providers
      : ethereum ? [ethereum] : [];

    legacyProviders.forEach((nextProvider) => registerWallet(nextProvider));
    window.addEventListener("eip6963:announceProvider", handleProviderAnnouncement as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Always offer WalletConnect as a connection option (works without a browser extension).
    setAvailableWallets((current) => {
      if (current.some((w) => w.id === WALLETCONNECT_OPTION_ID)) return current;
      return [
        ...current,
        { id: WALLETCONNECT_OPTION_ID, name: "WalletConnect", provider: null, source: "walletconnect" },
      ];
    });

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleProviderAnnouncement as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      void refreshSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSession]);

  useEffect(() => () => clearListeners(), [clearListeners]);

  const value = useMemo(
    () => ({
      address,
      availableWallets,
      chainId,
      connectWallet,
      disconnectWallet,
      ensureWalletAccess,
      hasActiveSession: sessionState === "active" && !!provider && !!address,
      isConnected: !!provider && !!address && sessionState !== "disconnected",
      provider,
      refreshSession,
      sessionState,
      switchChain,
      waitForActiveSession,
      walletName,
    }),
    [
      address,
      availableWallets,
      chainId,
      connectWallet,
      disconnectWallet,
      ensureWalletAccess,
      provider,
      refreshSession,
      sessionState,
      switchChain,
      waitForActiveSession,
      walletName,
    ]
  );

  return <WalletSessionContext.Provider value={value}>{children}</WalletSessionContext.Provider>;
}

export function useWalletSession() {
  const context = useContext(WalletSessionContext);
  if (!context) throw new Error("useWalletSession must be used within WalletSessionProvider.");
  return context;
}
