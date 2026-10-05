import { Info } from "lucide-react";

interface FeeBreakdownProps {
  marketRate?: number;
  effectiveRate?: number;
  feePercent?: number;
  amount: number;
  loading?: boolean;
}

export function FeeBreakdown({ marketRate, effectiveRate, feePercent, amount, loading }: FeeBreakdownProps) {
  if (loading) {
    return (
      <div className="p-3 bg-muted/30 rounded-xl space-y-2 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (!effectiveRate || !amount) return null;

  const amountKes = amount * effectiveRate;

  return (
    <div className="p-3 bg-muted/30 rounded-xl space-y-1.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" />
          Market Rate
        </span>
        <span className="font-mono">1 USDT = {marketRate?.toFixed(2)} KES</span>
      </div>
      {feePercent !== undefined && feePercent > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fee ({feePercent}%)</span>
          <span className="font-mono text-muted-foreground">
            -{((marketRate || 0) - (effectiveRate || 0)).toFixed(2)} KES
          </span>
        </div>
      )}
      <div className="border-t border-border pt-1.5 flex items-center justify-between font-medium">
        <span>You Get</span>
        <span className="text-primary font-mono">
          1 USDT = {effectiveRate?.toFixed(2)} KES
        </span>
      </div>
      {amount >= 0.5 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Total Receive</span>
          <span className="font-mono font-medium text-foreground">
            {amountKes.toLocaleString(undefined, { maximumFractionDigits: 0 })} KES
          </span>
        </div>
      )}
    </div>
  );
}
