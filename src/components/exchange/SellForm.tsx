import { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  RefreshCw,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NetworkSelector } from "./NetworkSelector";
import { CashoutMethodSelector } from "./CashoutMethodSelector";
import { FeeBreakdown } from "./FeeBreakdown";
import { useOfframp } from "@/hooks/useOfframp";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useElementPayTokens, type ElementPayToken } from "@/hooks/useElementPayTokens";
import { SUPPORTED_NETWORKS, type NetworkId, type CashoutMethod } from "@/types/exchange";
import { useToast } from "@/hooks/use-toast";
import { createWalletClient, custom, parseUnits } from "viem";
import { ELEMENTPAY_SPENDER_ADDRESSES, ERC20_ABI, WALLET_SUPPORTED_NETWORKS } from "@/config/contracts";
import { CHAIN_BY_ID, NETWORK_TO_CHAIN_ID, type SupportedChainId } from "@/config/wagmi";
import { WalletConnectControl } from "./WalletConnectControl";
import { useWalletSession } from "@/hooks/useWalletSession";
import { getPublicClientForChain } from "@/lib/publicClients";
import { useAmountLimits, formatLimitAmount } from "@/hooks/useAmountLimits";
import {
  CustomerIdentityFields,
  identityToRequest,
  useCustomerIdentity,
  type CustomerIdentity,
} from "./CustomerIdentityFields";


export function SellForm() {
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [network, setNetwork] = useState<NetworkId>("base");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [cashoutMethod, setCashoutMethod] = useState<CashoutMethod>("PHONE");
  const [tillNumber, setTillNumber] = useState("");
  const [paybillNumber, setPaybillNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [sellClientRef, setSellClientRef] = useState<string | null>(null);
  // Element Pay quote id for the current sell attempt. Retries reuse it so a
  // single wallet approval can never spawn a second payout order.
  const [sellQuoteId, setSellQuoteId] = useState<string | undefined>(undefined);
  // Element Pay settles an off-ramp only when the exact token amount is SENT
  // to the deposit wallet it issues per order — there is no allowance pull.
  // These hold the deposit instructions and the user's transfer for the
  // current attempt so a retry never re-charges the user.
  const [deposit, setDeposit] = useState<{ address: string; amount: number } | null>(null);
  const [settlementTxHash, setSettlementTxHash] = useState<`0x${string}` | null>(null);
  const [orderCreated, setOrderCreated] = useState(false);
  // Single-flight: a double click or a stray retry must never start a 2nd order.
  const sellInFlight = useRef(false);
  const customer = useCustomerIdentity();
  // Identity captured for the current attempt so retries reuse the exact values.
  const [activeIdentity, setActiveIdentity] = useState<CustomerIdentity | null>(null);


  const parsedAmount = parseFloat(amount) || 0;
  const offramp = useOfframp();
  const { rate, loading: rateLoading, error: rateError } = useExchangeRate(parsedAmount, network);
  const { getAvailableTokens, loading: tokensLoading } = useElementPayTokens();
  const { toast } = useToast();
  const {
    address,
    chainId,
    disconnectWallet,
    ensureWalletAccess,
    hasActiveSession,
    isConnected,
    provider: sessionProvider,
    refreshSession,
    sessionState,
    switchChain,
  } = useWalletSession();

  const availableTokens = getAvailableTokens(network);
  const supportedNetworkOptions = useMemo(() => {
    return SUPPORTED_NETWORKS.flatMap((n) => {
      if (!WALLET_SUPPORTED_NETWORKS.includes(n.id)) return [];
      const tokens = getAvailableTokens(n.id);
      if (tokens.length === 0) return [];
      const labels = Array.from(new Set(tokens.map((t) => t.symbol.toUpperCase())));
      return [{ id: n.id, label: `${n.name} (${labels.join(" / ")})` }];
    });
  }, [getAvailableTokens]);

  useEffect(() => {
    if (availableTokens.length === 0 && supportedNetworkOptions.length > 0) {
      setNetwork(supportedNetworkOptions[0].id);
    }
  }, [availableTokens.length, supportedNetworkOptions]);

  useEffect(() => {
    if (availableTokens.length > 0) {
      const current = availableTokens.find((t) => t.address === selectedToken);
      if (!current) setSelectedToken(availableTokens[0].address);
    } else {
      setSelectedToken("");
    }
  }, [availableTokens, selectedToken]);

  const selectedTokenInfo = availableTokens.find((t) => t.address === selectedToken);
  const tokenSymbol = selectedTokenInfo?.symbol || "USDT";
  const tokenDecimals = selectedTokenInfo?.decimals ?? 6;

  // Sell limits come from the Element Pay catalog when it publishes them,
  // otherwise from the operator fallbacks (1 – 4,000).
  const sellLimits = useAmountLimits("sell");
  const amountBelowMin = amount !== "" && parsedAmount < sellLimits.min;
  const amountAboveMax = amount !== "" && parsedAmount > sellLimits.max;
  const amountRangeError = amountBelowMin
    ? `Minimum is ${formatLimitAmount(sellLimits.min)} ${tokenSymbol}`
    : amountAboveMax
      ? `Maximum is ${formatLimitAmount(sellLimits.max)} ${tokenSymbol}`
      : null;

  useEffect(() => {
    if (offramp.order?.reference) {
      offramp.startPolling(offramp.order.reference);
    }
  }, [offramp, offramp.order?.reference]);

  const hasWalletConnection = Boolean(isConnected && address && sessionProvider);
  const hasActiveWalletSession = Boolean(hasWalletConnection && hasActiveSession);
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const buildSellReference = () => `NYT-SELL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const waitForWalletChainSync = async (targetChainId: SupportedChainId) => {
    if (!sessionProvider?.request) {
      throw new Error("Wallet session is not active. Reconnect your wallet and try again.");
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const chainHex = await sessionProvider.request({ method: "eth_chainId" }).catch(() => null);
      const walletChainId = typeof chainHex === "string" ? Number.parseInt(chainHex, 16) : null;
      if (walletChainId === targetChainId) return sessionProvider;
      await sleep(700);
    }

    throw new Error("Your wallet did not finish switching networks. Confirm the switch in your wallet and try again.");
  };

  /**
   * ONE wallet confirmation, one network fee: a plain ERC-20 transfer of the
   * exact order amount to the deposit wallet Element Pay issued for the order.
   */
  const sendTokenTransfer = async (params: {
    to: `0x${string}`;
    amount: bigint;
    targetChainId: SupportedChainId;
    walletAddress: `0x${string}`;
  }): Promise<`0x${string}`> => {
    const activePublicClient = getPublicClientForChain(params.targetChainId);
    const provider = await waitForWalletChainSync(params.targetChainId);
    const activeWalletClient = createWalletClient({
      account: params.walletAddress,
      chain: CHAIN_BY_ID[params.targetChainId],
      transport: custom(provider as any),
    });

    const { request } = await activePublicClient.simulateContract({
      address: selectedToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [params.to, params.amount],
      account: params.walletAddress,
    } as any);
    const hash = (await activeWalletClient.writeContract(request as any)) as `0x${string}`;
    await activePublicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  /**
   * Create (or resume) the Element Pay order. One order per client reference:
   * a retry re-uses the same reference and quote id, so it can never create a
   * duplicate payout.
   */
  const createSellOrder = async (params: {
    amountFiat: number;
    amountToken: string;
    clientRef: string;
    network: NetworkId;
    phoneNumber: string;
    recipientName: string;
    institution: CashoutMethod;
    userAddress: string;
    token: string;
    resumeQuoteId?: string;
    identity: CustomerIdentity;
  }) => {
    const result = await offramp.createOrder({
      amountFiat: params.amountFiat,
      amountToken: params.amountToken,
      tokenDecimals,
      clientRef: params.clientRef,
      network: params.network,
      phoneNumber: params.phoneNumber,
      recipientName: params.recipientName,
      institution: params.institution,
      userAddress: params.userAddress,
      token: params.token,
      resumeQuoteId: params.resumeQuoteId,
      ...identityToRequest(params.identity),
    });

    if (result.error?.quoteId) setSellQuoteId(result.error.quoteId);
    if (result.order?.quoteId) setSellQuoteId(result.order.quoteId);
    return result.order;
  };

  /**
   * Pay an already-created order: send the tokens to its deposit wallet and
   * register the transfer with Element Pay.
   */
  const payOrder = async (params: {
    reference: string;
    depositAddress: string;
    amountBase: bigint;
    targetChainId: SupportedChainId;
    walletAddress: `0x${string}`;
    existingHash?: `0x${string}` | null;
  }) => {
    let hash = params.existingHash ?? null;
    if (!hash) {
      offramp.setStep("deposit");
      hash = await sendTokenTransfer({
        to: params.depositAddress as `0x${string}`,
        amount: params.amountBase,
        targetChainId: params.targetChainId,
        walletAddress: params.walletAddress,
      });
      setSettlementTxHash(hash);
    }

    offramp.setStep("confirming");
    const confirmed = await offramp.confirmSettlement({
      reference: params.reference,
      txHash: hash,
      token: selectedToken,
    });
    if (!confirmed.ok) {
      offramp.setError(confirmed.error);
      return false;
    }
    return true;
  };

  const validateInputs = (): boolean => {
    if (parsedAmount < sellLimits.min) {
      toast({ title: `Minimum amount is ${formatLimitAmount(sellLimits.min)} ${tokenSymbol}`, variant: "destructive" });
      return false;
    }
    if (parsedAmount > sellLimits.max) {
      toast({ title: `Maximum amount is ${formatLimitAmount(sellLimits.max)} ${tokenSymbol}`, variant: "destructive" });
      return false;
    }
    if (!hasWalletConnection) {
      toast({ title: "Connect your wallet to sell", variant: "destructive" });
      return false;
    }
    if (!selectedToken) {
      toast({ title: "Select a token", variant: "destructive" });
      return false;
    }
    if (!ELEMENTPAY_SPENDER_ADDRESSES[network]) {
      toast({ title: `${network} not supported for sell yet`, variant: "destructive" });
      return false;
    }
    if (cashoutMethod === "PHONE") {
      if (!phoneNumber || !/^\+?[0-9]{10,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
        toast({ title: "Enter a valid M-Pesa phone number", variant: "destructive" });
        return false;
      }
      if (!recipientName || recipientName.trim().length < 2) {
        toast({ title: "Enter the recipient name", variant: "destructive" });
        return false;
      }
    } else if (cashoutMethod === "TILL") {
      if (!tillNumber) {
        toast({ title: "Enter the till number", variant: "destructive" });
        return false;
      }
    } else if (cashoutMethod === "PAYBILL") {
      if (!paybillNumber || !accountNumber) {
        toast({ title: "Enter paybill and account number", variant: "destructive" });
        return false;
      }
    } else if (cashoutMethod === "BANK") {
      if (!bankCode || !accountNumber || !recipientName) {
        toast({ title: "Fill in all bank details", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleSell = async () => {
    if (sellInFlight.current) return;
    if (!validateInputs()) return;
    if (!rate?.effectiveRate) {
      toast({ title: "Exchange rate not ready. Try again in a moment.", variant: "destructive" });
      return;
    }
    if (!address || !sessionProvider) {
      toast({ title: "Wallet not ready", variant: "destructive" });
      return;
    }

    // Element Pay's KE corridor requires the complete identity block on the
    // quote — validate it before asking the wallet for an approval.
    const identity = customer.validate();
    if (!identity) {
      toast({
        title: "Complete your details",
        description: "Our licensed payout partner requires your full KYC details.",
        variant: "destructive",
      });
      return;
    }
    setActiveIdentity(identity);

    // Fresh attempt.
    setSettlementTxHash(null);
    setOrderCreated(false);
    setDeposit(null);
    sellInFlight.current = true;


    // Force the extension to surface its UI (unlock prompt, approve prompt, etc.).
    // Without this, an "auto-connected" provider object can be stale and writeContract
    // will fail silently because MetaMask never gets a chance to wake up.
    const targetChainId = NETWORK_TO_CHAIN_ID[network] as SupportedChainId;
    let liveAccounts: string[] = [];
    try {
      liveAccounts = await ensureWalletAccess(sessionProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet did not respond";
      const friendly = /User rejected|denied/i.test(msg)
        ? "You rejected the wallet connection. Approve it in the extension and try again."
        : "Open your wallet extension and approve the connection, then try again.";
      toast({ title: "Wallet not connected", description: friendly, variant: "destructive" });
      offramp.setError(friendly);
      sellInFlight.current = false;
      return;
    }

    if (liveAccounts.length === 0) {
      const description = "Open your wallet extension, unlock it, and approve the connection.";
      toast({ title: "Wallet locked", description, variant: "destructive" });
      offramp.setError(description);
      sellInFlight.current = false;
      return;
    }

    if (liveAccounts[0].toLowerCase() !== address.toLowerCase()) {
      const description = "The active account in your wallet changed. Reconnect and try again.";
      toast({ title: "Wallet account changed", description, variant: "destructive" });
      offramp.setError(description);
      await disconnectWallet().catch(() => undefined);
      sellInFlight.current = false;
      return;
    }

    const session = await refreshSession();
    const activeProvider = session.provider ?? sessionProvider;
    if (!activeProvider) {
      const description = "Wallet provider is not ready. Reconnect your wallet, then try again.";
      toast({ title: "Wallet not ready", description, variant: "destructive" });
      offramp.setError(description);
      sellInFlight.current = false;
      return;
    }

    const tokenAmountBase = parseUnits(parsedAmount.toString(), tokenDecimals);

    try {
      const currentChainHex = await activeProvider.request?.({ method: "eth_chainId" }).catch(() => null);
      const currentWalletChainId = typeof currentChainHex === "string"
        ? Number.parseInt(currentChainHex, 16)
        : chainId;

      const selectedChainPublicClient = getPublicClientForChain(targetChainId);
      const selectedBalance = (await selectedChainPublicClient.readContract({
        address: selectedToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      } as any)) as bigint;

      if (selectedBalance < tokenAmountBase) {
        const candidates: { network: NetworkId; chainName: string; token: ElementPayToken }[] = [];
        for (const candidateNetwork of WALLET_SUPPORTED_NETWORKS) {
          if (candidateNetwork === network) continue;
          const candidateChainId = NETWORK_TO_CHAIN_ID[candidateNetwork] as SupportedChainId | undefined;
          if (!candidateChainId) continue;
          const candidateTokens = getAvailableTokens(candidateNetwork).filter((t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase());
          for (const t of candidateTokens) {
            candidates.push({ network: candidateNetwork, chainName: CHAIN_BY_ID[candidateChainId]?.name ?? candidateNetwork, token: t });
          }
        }

        const balanceChecks = await Promise.all(candidates.map(async ({ network: net, chainName, token }) => {
          try {
            const cid = NETWORK_TO_CHAIN_ID[net] as SupportedChainId;
            const client = getPublicClientForChain(cid);
            const bal = (await client.readContract({
              address: token.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            } as any)) as bigint;
            return { network: net, chainName, token, balance: bal };
          } catch {
            return null;
          }
        }));

        const sufficient = balanceChecks.filter((r): r is NonNullable<typeof r> => r !== null && r.balance >= tokenAmountBase);
        const currentChainName = CHAIN_BY_ID[targetChainId]?.name ?? network;

        if (sufficient.length > 0) {
          const target = sufficient[0];
          offramp.setError(`You're on ${currentChainName} but your ${tokenSymbol} is on ${target.chainName}. Switch the network selector above to ${target.chainName} and try again.`);
          toast({ title: `Switch to ${target.chainName}`, description: `${tokenSymbol} balance found on ${target.chainName}, not on ${currentChainName}.`, variant: "destructive" });
        } else {
          const anyBalance = balanceChecks.filter((r): r is NonNullable<typeof r> => r !== null && r.balance > 0n);
          if (anyBalance.length > 0) {
            const target = anyBalance[0];
            offramp.setError(`Insufficient ${tokenSymbol} on ${currentChainName}. The largest balance we found is on ${target.chainName}, but it's still below ${parsedAmount} ${tokenSymbol}. Top up or lower the amount.`);
          } else {
            offramp.setError(`No ${tokenSymbol} balance found on any supported network for this wallet. Send ${tokenSymbol} to ${address.slice(0, 6)}…${address.slice(-4)} first.`);
          }
        }
        sellInFlight.current = false;
        return;
      }

      if (currentWalletChainId !== targetChainId) {
        offramp.setStep("switching-chain");
        await switchChain(targetChainId, activeProvider);
      }

      // 1. Create the order FIRST — no wallet signature needed, nothing spent.
      const amountKes = Math.round(parsedAmount * rate.effectiveRate * 100) / 100;
      const clientRef = buildSellReference();
      setSellClientRef(clientRef);
      setSellQuoteId(undefined);

      const order = await createSellOrder({
        amountFiat: amountKes,
        amountToken: tokenAmountBase.toString(),
        clientRef,
        network,
        phoneNumber,
        recipientName,
        institution: cashoutMethod,
        userAddress: address,
        token: selectedToken,
        identity,
      });
      if (!order) return;
      setOrderCreated(true);

      const depositAddress = order.deposit?.address;
      if (!depositAddress) {
        offramp.setError(
          "Element Pay did not give a deposit address for this order. Nothing has left your wallet — please try again."
        );
        return;
      }
      setDeposit({ address: depositAddress, amount: order.deposit?.amount ?? parsedAmount });

      // 2. ONE wallet transaction: send the tokens to that deposit wallet.
      await payOrder({
        reference: order.reference ?? clientRef,
        depositAddress,
        amountBase: tokenAmountBase,
        targetChainId,
        walletAddress: address as `0x${string}`,
      });
    } catch (err) {
      const msg = err instanceof Error
        ? err.message.includes("User rejected") || err.message.includes("User denied")
          ? "Transaction rejected"
          : err.message
        : "Transaction failed";
      offramp.setError(msg);
    } finally {
      sellInFlight.current = false;
    }
  };

  const clearForm = () => {
    setAmount("");
    setPhoneNumber("");
    setRecipientName("");
    setTillNumber("");
    setPaybillNumber("");
    setAccountNumber("");
    setBankCode("");
  };

  const handleNewOrder = () => {
    offramp.reset();
    clearForm();
    setSettlementTxHash(null);
    setOrderCreated(false);
    setDeposit(null);
    setSellClientRef(null);
    setSellQuoteId(undefined);
    sellInFlight.current = false;
  };

  const safeDisconnect = async () => {
    await disconnectWallet().catch(() => undefined);
  };

  /**
   * Resume the current attempt without ever creating a second order:
   * - order not created yet -> create it with the SAME reference
   * - order created, tokens not sent -> ask the wallet for the transfer
   * - tokens sent -> just re-register the transfer with Element Pay
   */
  const retrySell = async () => {
    if (sellInFlight.current) return;
    if (!address || !rate?.effectiveRate || !selectedToken || !sellClientRef) {
      toast({ title: "Cannot retry — start a new order.", variant: "destructive" });
      return;
    }
    const identity = activeIdentity ?? customer.validate();
    if (!identity) {
      toast({ title: "Complete your details", description: "Your details are needed to create the order.", variant: "destructive" });
      return;
    }

    const targetChainId = NETWORK_TO_CHAIN_ID[network] as SupportedChainId;
    const tokenAmountBase = parseUnits(parsedAmount.toString(), tokenDecimals);
    const amountKes = Math.round(parsedAmount * rate.effectiveRate * 100) / 100;

    sellInFlight.current = true;
    try {
      let depositAddress = deposit?.address ?? null;

      if (!orderCreated || !depositAddress) {
        const order = await createSellOrder({
          amountFiat: amountKes,
          amountToken: tokenAmountBase.toString(),
          clientRef: sellClientRef,
          network,
          phoneNumber,
          recipientName,
          institution: cashoutMethod,
          userAddress: address,
          token: selectedToken,
          resumeQuoteId: sellQuoteId,
          identity,
        });
        if (!order) return;
        setOrderCreated(true);
        depositAddress = order.deposit?.address ?? null;
        if (!depositAddress) {
          offramp.setError("Element Pay did not give a deposit address for this order. Nothing has left your wallet.");
          return;
        }
        setDeposit({ address: depositAddress, amount: order.deposit?.amount ?? parsedAmount });
      }

      await payOrder({
        reference: sellClientRef,
        depositAddress,
        amountBase: tokenAmountBase,
        targetChainId,
        walletAddress: address as `0x${string}`,
        existingHash: settlementTxHash,
      });
    } catch (err) {
      offramp.setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      sellInFlight.current = false;
    }
  };

  const isFormValid =
    parsedAmount >= sellLimits.min &&
    parsedAmount <= sellLimits.max &&
    hasActiveWalletSession &&
    !!selectedToken &&
    customer.isComplete &&

    (() => {
      switch (cashoutMethod) {
        case "PHONE": return !!phoneNumber && !!recipientName;
        case "TILL": return !!tillNumber;
        case "PAYBILL": return !!paybillNumber && !!accountNumber;
        case "BANK": return !!bankCode && !!accountNumber && !!recipientName;
        default: return false;
      }
    })();

  if (offramp.step === "switching-chain" || offramp.step === "approving" || offramp.step === "confirming") {
    const labelMap: Record<string, { title: string; desc: string }> = {
      "switching-chain": { title: "Switch Network", desc: "Confirm the network change in your wallet…" },
      approving: { title: "Preparing", desc: "Getting your payout order ready…" },
      confirming: { title: "Creating Order", desc: "Element Pay is creating your sell order…" },
    };
    const info = labelMap[offramp.step];
    return (
      <div className="space-y-4 text-center py-8">
        <RefreshCw className="w-10 h-10 mx-auto animate-spin text-primary" />
        <h3 className="text-lg font-semibold">{info.title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{info.desc}</p>
        <Button variant="ghost" onClick={handleNewOrder} className="rounded-xl">Cancel</Button>
      </div>
    );
  }

  if (offramp.step === "deposit") {
    return (
      <div className="space-y-4 text-center py-8">
        <RefreshCw className="w-10 h-10 mx-auto animate-spin text-primary" />
        <h3 className="text-lg font-semibold">Confirm the transfer</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Approve the transfer in your wallet to send {deposit?.amount ?? parsedAmount} {tokenSymbol} to Element Pay.
          This is the only transaction you will be asked to sign.
        </p>
        {deposit?.address && (
          <p className="text-xs text-muted-foreground break-all">
            Send to: <code className="font-mono">{deposit.address}</code>
          </p>
        )}
      </div>
    );
  }

  if (offramp.step === "processing") {
    return (
      <div className="space-y-6 text-center py-6">
        <div className="flex justify-center"><div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center"><Clock className="w-8 h-8 text-amber-500 animate-pulse" /></div></div>
        <div>
          <h3 className="text-lg font-semibold mb-1">Processing Payout</h3>
          <p className="text-sm text-muted-foreground">Element Pay received your {tokenSymbol}. KES is being sent to {phoneNumber || "your account"}.</p>
        </div>
        {offramp.order?.reference && <p className="text-xs text-muted-foreground">Reference: <code className="font-mono">{offramp.order.reference}</code></p>}
        <Button variant="outline" onClick={handleNewOrder}>New Order</Button>
      </div>
    );
  }

  if (offramp.step === "complete") {
    return (
      <div className="space-y-6 text-center py-6">
        <div className="flex justify-center"><div className="w-16 h-16 rounded-full bg-nyati-green/10 flex items-center justify-center"><CheckCircle className="w-8 h-8 text-nyati-green" /></div></div>
        <div>
          <h3 className="text-lg font-semibold mb-1">Payout Complete!</h3>
          <p className="text-sm text-muted-foreground">Your KES has been sent. Check your phone for the M-Pesa confirmation.</p>
          <p className="text-xs text-muted-foreground mt-2">Tap "Done" to end your wallet session, or "Sell more" to start another order.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={handleNewOrder} className="rounded-xl">Sell more</Button>
          <Button variant="outline" className="rounded-xl" onClick={async () => { await safeDisconnect(); handleNewOrder(); toast({ title: "Wallet session ended", description: "Disconnected in Nyati." }); }}>Done</Button>
        </div>
      </div>
    );
  }

  if (offramp.step === "failed") {
    const isPostApproval = orderCreated;
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <div className="flex justify-center mb-3"><div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center"><XCircle className="w-8 h-8 text-destructive" /></div></div>
          <h3 className="text-lg font-semibold mb-1">{isPostApproval ? "Order needs finishing" : "Order Failed"}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {offramp.error || "We couldn't create your sell order."}
          </p>
          {isPostApproval ? (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={retrySell} className="rounded-xl">{settlementTxHash ? "Re-check my transfer" : "Continue this order"}</Button>
              <Button variant="outline" onClick={handleNewOrder} className="rounded-xl">Start over</Button>
            </div>
          ) : (
            <Button onClick={handleNewOrder} className="rounded-xl">Try Again</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-accent text-accent-foreground text-xs">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Sell crypto for M-Pesa</p>
          <p className="text-muted-foreground">Connect your wallet, send your {tokenSymbol} to the payout order in one transaction, and Element Pay sends KES to your account.</p>
        </div>
      </div>

      {offramp.error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{offramp.error}</div>}

      <div className="flex justify-center items-center gap-2 flex-wrap">
        <WalletConnectControl
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
          preferredChainId={NETWORK_TO_CHAIN_ID[network] as SupportedChainId}
        />
      </div>

      <NetworkSelector value={network} onChange={setNetwork} enabledNetworks={supportedNetworkOptions.map((o) => o.id)} />

      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground" />Token to sell</Label>
        {tokensLoading ? <div className="h-10 flex items-center text-sm text-muted-foreground">Loading tokens…</div> : availableTokens.length === 0 ? (
          <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">No supported tokens on this network. Pick another network above.</div>
        ) : (
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger className="h-12 bg-muted/30"><SelectValue placeholder="Select token" /></SelectTrigger>
            <SelectContent>{availableTokens.map((t) => <SelectItem key={t.address} value={t.address}>{t.symbol}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <CashoutMethodSelector
        cashoutMethod={cashoutMethod}
        onCashoutMethodChange={setCashoutMethod}
        phoneNumber={phoneNumber}
        onPhoneNumberChange={setPhoneNumber}
        recipientName={recipientName}
        onRecipientNameChange={setRecipientName}
        tillNumber={tillNumber}
        onTillNumberChange={setTillNumber}
        paybillNumber={paybillNumber}
        onPaybillNumberChange={setPaybillNumber}
        accountNumber={accountNumber}
        onAccountNumberChange={setAccountNumber}
        bankCode={bankCode}
        onBankCodeChange={setBankCode}
      />

      <CustomerIdentityFields
        identity={customer.identity}
        errors={customer.errors}
        onChange={customer.update}
      />



      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">You Send</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatLimitAmount(sellLimits.min)} – {formatLimitAmount(sellLimits.max)} {tokenSymbol}
            </span>
            <button
              type="button"
              onClick={() => setAmount(String(sellLimits.max))}
              className="text-xs font-medium text-primary hover:underline"
            >
              Max
            </button>
          </div>
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 text-lg pr-16 bg-muted/30"
            min={sellLimits.min}
            max={sellLimits.max}
            step="0.01"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-muted rounded-md text-sm font-medium">{tokenSymbol}</div>
        </div>
        {amountRangeError && <p className="text-xs text-destructive">{amountRangeError}</p>}
      </div>

      <FeeBreakdown marketRate={rate?.marketRate} effectiveRate={rate?.effectiveRate} feePercent={rate?.feePercent} amount={parsedAmount} loading={rateLoading} />
      {rateError && <div className="p-2.5 rounded-xl bg-destructive/10 text-xs text-destructive">{rateError}</div>}

      {!hasWalletConnection ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400"><Info className="w-3.5 h-3.5 shrink-0" /><span>Connect a wallet above to continue.</span></div>
      ) : !hasActiveWalletSession ? (
        <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {sessionState === "locked"
                ? "Your wallet extension is locked. Reconnect to unlock and approve."
                : sessionState === "stale"
                  ? "The active account in your wallet changed. Reconnect to continue."
                  : "Your wallet needs to re-approve this site. Reconnect to continue."}
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg" onClick={async () => { await disconnectWallet().catch(() => undefined); }}>
            Reconnect
          </Button>
        </div>
      ) : null}

      <Button className="w-full h-14 text-lg rounded-xl glow-primary mt-2" onClick={handleSell} disabled={!isFormValid}>
        <>Sell {tokenSymbol} for KES <ArrowRight className="w-5 h-5 ml-2" /></>
      </Button>
    </div>
  );
}
