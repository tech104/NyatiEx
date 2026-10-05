import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

type TransactionType = "deposit" | "withdraw" | "exchange";

interface TransactionItemProps {
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  status: "completed" | "pending" | "failed";
}

const typeConfig = {
  deposit: {
    icon: ArrowDownToLine,
    label: "Deposit",
    color: "text-crypto-green",
    bgColor: "bg-crypto-green/10",
  },
  withdraw: {
    icon: ArrowUpFromLine,
    label: "Withdraw",
    color: "text-crypto-red",
    bgColor: "bg-crypto-red/10",
  },
  exchange: {
    icon: ArrowLeftRight,
    label: "Exchange",
    color: "text-crypto-blue",
    bgColor: "bg-crypto-blue/10",
  },
};

const statusConfig = {
  completed: {
    label: "Completed",
    className: "bg-crypto-green/10 text-crypto-green",
  },
  pending: {
    label: "Pending",
    className: "bg-crypto-yellow/10 text-crypto-yellow",
  },
  failed: {
    label: "Failed",
    className: "bg-crypto-red/10 text-crypto-red",
  },
};

export function TransactionItem({ type, amount, currency, date, status }: TransactionItemProps) {
  const config = typeConfig[type];
  const statusStyle = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", config.bgColor)}>
          <Icon className={cn("w-5 h-5", config.color)} />
        </div>
        <div>
          <p className="font-semibold text-foreground">{config.label}</p>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
      </div>

      <div className="text-right flex items-center gap-4">
        <div>
          <p className={cn("font-semibold", type === "deposit" ? "text-crypto-green" : type === "withdraw" ? "text-crypto-red" : "text-foreground")}>
            {type === "deposit" ? "+" : type === "withdraw" ? "-" : ""}${amount.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">{currency}</p>
        </div>
        <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusStyle.className)}>
          {statusStyle.label}
        </span>
      </div>
    </div>
  );
}
