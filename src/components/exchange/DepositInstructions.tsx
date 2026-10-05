import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Clock, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import type { OfframpOrderResponse } from "@/types/exchange";
import { SUPPORTED_NETWORKS } from "@/types/exchange";

interface DepositInstructionsProps {
  order: OfframpOrderResponse;
  onBack: () => void;
}

export function DepositInstructions({ order, onBack }: DepositInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  const networkInfo = SUPPORTED_NETWORKS.find((n) => n.id === order.network);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(order.receiveAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!order.validUntil) return;

    const updateTimer = () => {
      const diff = new Date(order.validUntil).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order.validUntil]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Status Header */}
      <div className="text-center space-y-2">
        <Badge variant="outline" className="px-4 py-2 border-primary/30 bg-primary/5">
          <Clock className="w-3 h-3 mr-2" />
          Waiting for deposit
        </Badge>
        <p className="text-sm text-muted-foreground">
          Send exactly the amount below to complete your order
        </p>
      </div>

      {/* Amount to Send */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Send exactly</p>
          <p className="font-display text-3xl font-bold text-primary">
            {order.totalToSend.toFixed(2)} USDT
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {order.amount.toFixed(2)} USDT + {order.senderFee.toFixed(2)} fee + {order.transactionFee.toFixed(6)} network fee
          </p>
        </CardContent>
      </Card>

      {/* Network */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
        <span className="text-muted-foreground">Network</span>
        <span className="font-medium flex items-center gap-1">
          {networkInfo && <img src={networkInfo.logo} alt={networkInfo.name} className="w-4 h-4 rounded-full" />} {networkInfo?.name}
        </span>
      </div>

      {/* Deposit Address */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Deposit Address</p>
        <div
          onClick={copyAddress}
          className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <code className="flex-1 text-xs break-all font-mono">
            {order.receiveAddress}
          </code>
          {copied ? (
            <Check className="w-4 h-4 text-nyati-green shrink-0" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </div>

      {/* You Will Receive */}
      <div className="flex items-center justify-between p-3 bg-nyati-green-light rounded-xl text-sm">
        <span className="text-muted-foreground">You'll receive on M-Pesa</span>
        <span className="font-semibold text-nyati-green font-mono">
          {order.amountKes.toLocaleString()} KES
        </span>
      </div>

      {/* Timer */}
      {order.validUntil && (
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Time remaining
          </span>
          <span className={`font-mono font-medium ${timeLeft === "Expired" ? "text-destructive" : ""}`}>
            {timeLeft}
          </span>
        </div>
      )}

      {/* Reference */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
        <span className="text-muted-foreground">Reference</span>
        <span className="font-mono text-xs">{order.reference}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          New Order
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Once you send USDT to the address above, the KES will be sent to the M-Pesa number automatically.
        Status updates will appear here.
      </p>
    </div>
  );
}
