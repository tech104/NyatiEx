import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, Loader2, ExternalLink, KeyRound, LogOut, Copy, ChevronDown, Check, QrCode } from "lucide-react";
import { isAddress } from "viem";
import { useToast } from "@/hooks/use-toast";
import { useWalletSession } from "@/hooks/useWalletSession";
import type { SupportedChainId } from "@/config/wagmi";

const INSTALL_LINKS: Record<string, string> = {
  MetaMask: "https://metamask.io/download/",
  "Coinbase Wallet": "https://www.coinbase.com/wallet/downloads",
  Rabby: "https://rabby.io/",
  "Trust Wallet": "https://trustwallet.com/download",
  Core: "https://core.app/",
};

type WalletConnectControlProps = {
  accountStatus?: "address" | "avatar" | "full";
  chainStatus?: "icon" | "name" | "full" | "none";
  showBalance?: boolean;
  onManualAddress?: (address: string) => void;
  preferredChainId?: SupportedChainId;
};

export function WalletConnectControl({ accountStatus, onManualAddress, preferredChainId }: WalletConnectControlProps) {
  const {
    address,
    availableWallets,
    connectWallet,
    disconnectWallet,
    hasActiveSession,
    isConnected,
    sessionState,
    switchChain,
    waitForActiveSession,
    walletName,
  } = useWalletSession();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const missingWallets = useMemo(
    () => Object.keys(INSTALL_LINKS).filter((name) => !availableWallets.some((wallet) => wallet.name === name)),
    [availableWallets]
  );

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const currentLabel = walletName || "Wallet connected";

  const clearLocalError = () => setErrorMessage(null);

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast({ title: "Address copied", description: shortAddress });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleDisconnect = () => {
    void disconnectWallet().finally(() => {
      toast({ title: "Wallet disconnected" });
    });
  };

  const handleManualSubmit = () => {
    const trimmed = manualAddress.trim();
    if (!isAddress(trimmed)) {
      toast({ title: "Invalid wallet address", description: "Enter a valid 0x… EVM address.", variant: "destructive" });
      return;
    }
    onManualAddress?.(trimmed);
    setOpen(false);
    setShowManual(false);
    setManualAddress("");
    toast({ title: "Wallet address saved", description: `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}` });
  };

  const connectWith = async (walletId: string) => {
    setPendingKey(walletId);
    clearLocalError();

    try {
      await connectWallet(walletId);
      const session = await waitForActiveSession({ timeoutMs: 10_000, pollMs: 500 });
      if (session.state !== "active" || !session.provider) {
        throw new Error(
          session.state === "locked"
            ? "Your wallet is locked. Unlock it in the extension and try again."
            : "Wallet connection did not finish in the extension. Open the wallet and approve the connection."
        );
      }

      if (preferredChainId) {
        await switchChain(preferredChainId, session.provider);
      }

      setOpen(false);
      toast({ title: "Wallet connected" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setErrorMessage(message);
      if (!/User rejected|denied/i.test(message)) {
        toast({ title: "Connection failed", description: message, variant: "destructive" });
      }
    } finally {
      setPendingKey(null);
    }
  };

  if (isConnected && address && hasActiveSession) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-11 rounded-xl px-4">
            <Wallet className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{currentLabel}</span>
            {accountStatus !== "avatar" && <span className="ml-2 text-muted-foreground">{shortAddress}</span>}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Connected via {currentLabel}</span>
              <span className="font-mono text-sm">{shortAddress}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopyAddress}>
            <Copy className="mr-2 h-4 w-4" />
            Copy address
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              await disconnectWallet().catch(() => undefined);
              clearLocalError();
              setShowManual(false);
              setOpen(true);
            }}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Reconnect wallet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDisconnect} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <div className="flex justify-center">
        <Button
          type="button"
          onClick={() => {
            clearLocalError();
            setShowManual(false);
            setOpen(true);
          }}
          className="h-11 rounded-xl px-4"
        >
          <Wallet className="mr-2 h-4 w-4" />
          Connect wallet
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          clearLocalError();
          if (!next) setShowManual(false);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Connect a wallet</DialogTitle>
            <DialogDescription>
              Choose a wallet to continue
              {onManualAddress ? " — or paste a receive-only address" : ""}.
            </DialogDescription>
          </DialogHeader>

          {!showManual && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet</Label>
                {availableWallets.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    No compatible wallet was detected in this browser.
                  </div>
                ) : (
                  availableWallets.map((item) => {
                    const connecting = pendingKey === item.id;
                    const isWalletConnect = item.source === "walletconnect";
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-start rounded-xl"
                        onClick={() => connectWith(item.id)}
                        disabled={!!pendingKey}
                      >
                        {connecting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isWalletConnect ? (
                          <QrCode className="mr-2 h-4 w-4" />
                        ) : (
                          <Wallet className="mr-2 h-4 w-4" />
                        )}
                        <div className="flex flex-col items-start">
                          <span>{isWalletConnect ? "WalletConnect (Mobile / QR)" : item.name}</span>
                          {isWalletConnect && (
                            <span className="text-xs text-muted-foreground">Scan with any mobile wallet</span>
                          )}
                        </div>
                      </Button>
                    );
                  })
                )}
              </div>

              {availableWallets.every((w) => w.source === "walletconnect") && missingWallets.length > 0 && (
                <div>
                  <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Install a wallet</p>
                  <div className="space-y-2">
                    {missingWallets.map((name) => (
                      <a
                        key={name}
                        href={INSTALL_LINKS[name]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-11 w-full items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 px-4 text-sm text-muted-foreground hover:bg-muted/40"
                      >
                        <span className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Install {name}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {onManualAddress && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full justify-start rounded-xl border border-dashed border-border"
                  onClick={() => setShowManual(true)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Use a wallet address manually
                </Button>
              )}

              {isConnected && address && !hasActiveSession ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {sessionState === "locked"
                    ? "This browser has a remembered wallet, but the extension is still locked. Unlock it, then connect again."
                    : "This browser has a remembered wallet, but the extension has not approved the connection yet. Open the wallet extension and reconnect."}
                </div>
              ) : null}
            </div>
          )}

          {showManual && onManualAddress && (
            <div className="space-y-3">
              <Label htmlFor="manual-wallet-address" className="text-sm">Wallet address (EVM)</Label>
              <Input
                id="manual-wallet-address"
                placeholder="0x…"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                className="h-11 rounded-xl font-mono text-sm"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Receive-only. You'll still need to sign approvals from your wallet for sell orders.</p>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => setShowManual(false)}>Back</Button>
                <Button type="button" onClick={handleManualSubmit} disabled={!manualAddress.trim()}>
                  <Check className="mr-2 h-4 w-4" />
                  Save address
                </Button>
              </DialogFooter>
            </div>
          )}

          {errorMessage && !showManual ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
