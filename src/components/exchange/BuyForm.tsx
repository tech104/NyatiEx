import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Phone, Wallet, ArrowDownUp, ArrowRight, Info, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { NetworkSelector } from "./NetworkSelector";
import { SUPPORTED_NETWORKS, type NetworkId } from "@/types/exchange";
import { useOnramp } from "@/hooks/useOnramp";
import { useElementPayTokens } from "@/hooks/useElementPayTokens";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WalletConnectControl } from "./WalletConnectControl";
import { useWalletSession } from "@/hooks/useWalletSession";
import { useAmountLimits, formatLimitAmount } from "@/hooks/useAmountLimits";
import {
  CustomerIdentityFields,
  identityToRequest,
  useCustomerIdentity,
} from "./CustomerIdentityFields";

export function BuyForm() {
  const [kesAmount, setKesAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState<NetworkId>("base");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const { address, isConnected } = useWalletSession();
  const { toast } = useToast();
  const customer = useCustomerIdentity();

  const onramp = useOnramp();
  const { getAvailableTokens, loading: tokensLoading } = useElementPayTokens();


  const availableTokens = getAvailableTokens(network);
  const supportedNetworkOptions = SUPPORTED_NETWORKS.flatMap((supportedNetwork) => {
    const tokens = getAvailableTokens(supportedNetwork.id);
    if (tokens.length === 0) return [];

    const tokenLabels = Array.from(new Set(tokens.map((token) => token.symbol.toUpperCase())));

    return [
      {
        id: supportedNetwork.id,
        label: `${supportedNetwork.name} (${tokenLabels.join(" / ")})`,
      },
    ];
  });
  const effectiveWalletAddress = isConnected && address ? address : walletAddress;
  const parsedKes = parseFloat(kesAmount) || 0;

  // Auto-select a supported network if current one has no tokens
  useEffect(() => {
    if (availableTokens.length === 0 && supportedNetworkOptions.length > 0) {
      setNetwork(supportedNetworkOptions[0].id);
    }
  }, [availableTokens, supportedNetworkOptions]);

  // Auto-select first available token when network changes
  useEffect(() => {
    if (availableTokens.length > 0) {
      const current = availableTokens.find((t) => t.address === selectedToken);
      if (!current) {
        setSelectedToken(availableTokens[0].address);
      }
    } else {
      setSelectedToken("");
    }
  }, [availableTokens, selectedToken]);

  const selectedTokenInfo = availableTokens.find((t) => t.address === selectedToken);
  const tokenSymbol = selectedTokenInfo?.symbol || "USDT";

  // Buy limits come from the Element Pay catalog when published, otherwise
  // from the operator fallbacks (KES 10 – 450,000).
  const buyLimits = useAmountLimits("buy");
  const kesRangeError =
    kesAmount !== "" && parsedKes < buyLimits.min
      ? `Minimum is ${buyLimits.currency} ${formatLimitAmount(buyLimits.min)}`
      : kesAmount !== "" && parsedKes > buyLimits.max
        ? `Maximum is ${buyLimits.currency} ${formatLimitAmount(buyLimits.max)}`
        : null;

  // Placeholder rate
  const estimatedAmount = parsedKes ? (parsedKes / 130).toFixed(2) : "0";

  const handleBuy = async () => {
    if (parsedKes < buyLimits.min) {
      toast({ title: `Minimum amount is ${buyLimits.currency} ${formatLimitAmount(buyLimits.min)}`, variant: "destructive" });
      return;
    }
    if (parsedKes > buyLimits.max) {
      toast({ title: `Maximum amount is ${buyLimits.currency} ${formatLimitAmount(buyLimits.max)}`, variant: "destructive" });
      return;
    }
    if (!phoneNumber || !/^\+?[0-9]{10,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
      toast({ title: "Enter a valid M-Pesa phone number", variant: "destructive" });
      return;
    }
    if (!effectiveWalletAddress) {
      toast({ title: "Enter or connect a wallet address", variant: "destructive" });
      return;
    }
    if (!selectedToken) {
      toast({ title: `No supported token on this network via Element Pay`, variant: "destructive" });
      return;
    }

    const identity = customer.validate();
    if (!identity) {
      toast({ title: "Complete your details", description: "Our payout partner requires your full KYC details.", variant: "destructive" });
      return;
    }

    const result = await onramp.createBuyOrder({
      amountFiat: parsedKes,
      phoneNumber: phoneNumber.replace(/\s/g, ""),
      walletAddress: effectiveWalletAddress,
      token: selectedToken,
      network,
      ...identityToRequest(identity),
    });


    if (result) {
      onramp.startPolling(result.reference);
    }
  };

  const handleNewOrder = () => {
    onramp.reset();
    setKesAmount("");
    setPhoneNumber("");
    setWalletAddress("");
  };

  // Processing state — kept until Element Pay verifies a terminal outcome.
  if (onramp.step === "processing" || onramp.step === "confirming") {
    const awaitingPin = onramp.txStatus === "pending" || onramp.txStatus === null;
    const providerProcessing = onramp.txStatus === "processing" || onramp.txStatus === "validated";
    const dbSettledButUnverified = onramp.txStatus === "settled" && !onramp.providerVerifiedSettled;

    return (
      <div className="space-y-4 text-center py-6">
        <RefreshCw className="w-10 h-10 mx-auto animate-spin text-primary" />
        <h3 className="text-lg font-semibold">Processing Your Purchase</h3>

        {awaitingPin && (
          <p className="text-sm text-muted-foreground">
            An M-Pesa STK push has been sent to your phone. Please enter your PIN to confirm.
          </p>
        )}
        {providerProcessing && (
          <p className="text-sm text-muted-foreground">
            Payment received. Element Pay is finalising settlement to your wallet…
          </p>
        )}
        {dbSettledButUnverified && (
          <p className="text-sm text-muted-foreground">
            Awaiting final confirmation from Element Pay. Please don't close this screen.
          </p>
        )}

        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Do not leave this screen until the M-Pesa payment is approved or fails.
        </p>

        {onramp.isSandbox && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Sandbox Mode</p>
              <p>Element Pay sandbox may not send a real STK push. You can simulate completion below for testing.</p>
            </div>
          </div>
        )}
        {onramp.reference && (
          <p className="text-xs text-muted-foreground">
            Reference: <code className="font-mono">{onramp.reference}</code>
          </p>
        )}
        {onramp.rateUsed && (
          <p className="text-sm">
            Rate:{" "}
            <span className="font-medium">
              1 {tokenSymbol} = KES {onramp.rateUsed.toFixed(2)}
            </span>
          </p>
        )}
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {onramp.reference && (
            <Button
              variant="secondary"
              onClick={() => onramp.checkStatusNow(onramp.reference!)}
              className="rounded-xl"
              disabled={onramp.step === "confirming"}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Check Status Now
            </Button>
          )}
          {onramp.isSandbox && (
            <Button onClick={onramp.simulateComplete} className="rounded-xl">
              <CheckCircle className="w-4 h-4 mr-2" />
              Simulate Complete
            </Button>
          )}
          <Button variant="ghost" onClick={handleNewOrder} className="rounded-xl">
            Cancel & Start Over
          </Button>
        </div>
        {!onramp.isSandbox && (
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            This screen will move on automatically once Element Pay confirms settlement.
          </p>
        )}
      </div>
    );
  }

  // Failed state — explicit failure path so the user never sees a fake "complete".
  if (onramp.step === "failed" && onramp.reference) {
    return (
      <div className="space-y-4 text-center py-6 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold">Purchase Could Not Be Completed</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {onramp.error ?? "The payment was not confirmed by Element Pay."}
        </p>
        {onramp.reference && (
          <p className="text-xs text-muted-foreground">
            Reference: <code className="font-mono">{onramp.reference}</code>
          </p>
        )}
        <Button onClick={handleNewOrder} className="rounded-xl mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  // Complete state
  if (onramp.step === "complete") {
    const networkInfo = SUPPORTED_NETWORKS.find((n) => n.id === network);
    return (
      <div className="space-y-5 py-4 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">Purchase Complete!</h3>
          <p className="text-sm text-muted-foreground">Your {tokenSymbol} has been sent to your wallet.</p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">You paid</span>
            <span className="font-mono font-medium">
              KES {onramp.fiatPaid?.toLocaleString() ?? parsedKes.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">You received</span>
            <span className="font-mono font-medium text-primary">
              {onramp.amountSent?.toFixed(6) ?? "—"} {tokenSymbol}
            </span>
          </div>
          {onramp.rateUsed && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono">
                1 {tokenSymbol} = KES {onramp.rateUsed.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Network</span>
            <span className="flex items-center gap-1.5">
              {networkInfo && <img src={networkInfo.logo} alt={networkInfo.name} className="w-4 h-4 rounded-full" />}
              {networkInfo?.name ?? network}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono text-xs truncate max-w-[180px]">{effectiveWalletAddress}</span>
          </div>
          {onramp.reference && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Reference</span>
              <code className="font-mono text-xs">{onramp.reference}</code>
            </div>
          )}
        </div>

        <Button onClick={handleNewOrder} className="w-full h-12 rounded-xl">
          Buy More
        </Button>
      </div>
    );
  }

  const isProcessing = false;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-accent text-accent-foreground text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Buy crypto with M-Pesa</p>
          <p className="text-muted-foreground">
            Enter the KES amount, your M-Pesa number, and where to receive tokens. You'll get an STK push to confirm
            payment.
          </p>
        </div>
      </div>

      {/* Error */}
      {onramp.error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          {onramp.error}
          {onramp.isSandbox && (
            <p className="mt-2 text-xs text-muted-foreground">
              ⚠️ This appears to be a sandbox/config issue. Ensure <code>ELEMENTPAY_API_KEY</code> is set in your
              Supabase Edge Function secrets.
            </p>
          )}
        </div>
      )}

      {/* Wallet connect */}
      <div className="flex justify-center">
        <WalletConnectControl
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
          onManualAddress={(addr) => setWalletAddress(addr)}
        />
      </div>

      {/* M-Pesa Phone Number */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-muted-foreground" />
          M-Pesa Number (to pay from)
        </Label>
        <Input
          type="tel"
          placeholder="+254 7XX XXX XXX"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="h-12 bg-muted/30"
        />
      </div>

      <CustomerIdentityFields
        identity={customer.identity}
        errors={customer.errors}
        onChange={customer.update}
      />



      {/* Wallet Address */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          Wallet Address (to receive tokens)
        </Label>
        {isConnected && address ? (
          <div className="h-12 px-3 flex items-center bg-muted/30 rounded-md border border-input text-sm font-mono truncate">
            {address}
          </div>
        ) : (
          <Input
            type="text"
            placeholder="0x... (paste your wallet address)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="h-12 bg-muted/30 font-mono text-sm"
          />
        )}
      </div>

      {/* Network Selector */}
      <NetworkSelector
        value={network}
        onChange={setNetwork}
        enabledNetworks={supportedNetworkOptions.map((o) => o.id)}
      />

      {/* Token Selector */}
      <div className="space-y-2">
        <Label className="text-sm">Token to receive</Label>
        {tokensLoading ? (
          <div className="h-10 flex items-center text-sm text-muted-foreground">Loading tokens...</div>
        ) : availableTokens.length === 0 ? (
          <div className="space-y-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <p>No supported tokens on this network. Pick another network above.</p>
            {supportedNetworkOptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Choose a supported network below, then confirm the token in this field.
                </p>
                <div className="flex flex-wrap gap-2">
                  {supportedNetworkOptions.map((option) => (
                    <Button
                      key={option.id}
                      variant="outline"
                      className="h-8 rounded-full"
                      onClick={() => setNetwork(option.id)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger className="h-12 bg-muted/30">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              {availableTokens.map((t) => (
                <SelectItem key={t.address} value={t.address}>
                  {t.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* You Pay (KES) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">You Pay</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {buyLimits.currency} {formatLimitAmount(buyLimits.min)} – {formatLimitAmount(buyLimits.max)}
            </span>
            <button
              type="button"
              onClick={() => setKesAmount(String(buyLimits.max))}
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
            value={kesAmount}
            onChange={(e) => setKesAmount(e.target.value)}
            className="h-14 text-lg pr-16 bg-muted/30"
            min={buyLimits.min}
            max={buyLimits.max}
            step="1"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-muted rounded-md text-sm font-medium">
            KES
          </div>
        </div>
        {kesRangeError && <p className="text-xs text-destructive">{kesRangeError}</p>}
      </div>

      {/* Swap Icon */}
      <div className="flex justify-center py-1">
        <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
          <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* You Receive */}
      <div className="space-y-2">
        <Label className="text-sm">You Receive (estimate)</Label>
        <div className="relative">
          <Input
            type="text"
            readOnly
            value={estimatedAmount}
            className="h-14 text-lg pr-16 bg-accent/50 border-primary/20 text-primary"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-muted rounded-md text-sm font-medium">
            {tokenSymbol}
          </div>
        </div>
      </div>

      {/* Rate info */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>Final rate confirmed by Element Pay at order creation</span>
      </div>

      {/* Submit */}
      <Button
        className="w-full h-14 text-lg rounded-xl glow-primary mt-2"
        onClick={handleBuy}
        disabled={
          isProcessing ||
          parsedKes < buyLimits.min ||
          parsedKes > buyLimits.max ||
          !phoneNumber ||
          !effectiveWalletAddress ||
          !selectedToken
        }
      >
        {isProcessing ? (
          <>
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            Creating Order...
          </>
        ) : (
          <>
            Buy {tokenSymbol} with M-Pesa <ArrowRight className="w-5 h-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
