import type { TransactionStatus } from "@/types/exchange";
import { Check, Clock, AlertTriangle, RotateCcw } from "lucide-react";

interface OrderStatusProps {
  status: TransactionStatus;
}

const STATUS_CONFIG: Record<TransactionStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "Waiting for Deposit", icon: <Clock className="w-5 h-5" />, color: "text-primary" },
  processing: { label: "Processing", icon: <Clock className="w-5 h-5 animate-spin" />, color: "text-primary" },
  validated: { label: "KES Sent to M-Pesa", icon: <Check className="w-5 h-5" />, color: "text-nyati-green" },
  settled: { label: "Complete", icon: <Check className="w-5 h-5" />, color: "text-nyati-green" },
  expired: { label: "Order Expired", icon: <AlertTriangle className="w-5 h-5" />, color: "text-destructive" },
  refunded: { label: "Refunded", icon: <RotateCcw className="w-5 h-5" />, color: "text-primary" },
};

const STEPS: TransactionStatus[] = ["pending", "processing", "validated", "settled"];

export function OrderStatus({ status }: OrderStatusProps) {
  const config = STATUS_CONFIG[status];
  const isTerminalError = status === "expired" || status === "refunded";

  const currentStepIndex = STEPS.indexOf(status);

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className={`flex items-center justify-center gap-2 ${config.color}`}>
        {config.icon}
        <span className="font-semibold">{config.label}</span>
      </div>

      {/* Progress Steps */}
      {!isTerminalError && (
        <div className="flex items-center justify-between px-2">
          {STEPS.map((step, i) => {
            const stepConfig = STATUS_CONFIG[step];
            const isCompleted = i <= currentStepIndex;
            const isCurrent = i === currentStepIndex;

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 transition-colors ${
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-muted-foreground"
                    } ${isCurrent ? "ring-2 ring-primary/30" : ""}`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center max-w-[60px]">
                    {stepConfig.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 ${
                      i < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error/Terminal Messages */}
      {status === "expired" && (
        <p className="text-sm text-center text-muted-foreground">
          This order has expired. No funds were charged. Please create a new order.
        </p>
      )}
      {status === "refunded" && (
        <p className="text-sm text-center text-muted-foreground">
          Your USDT has been refunded to the return address.
        </p>
      )}
      {status === "validated" && (
        <p className="text-sm text-center text-nyati-green">
          Success! KES has been sent to your M-Pesa number. 🎉
        </p>
      )}
    </div>
  );
}
