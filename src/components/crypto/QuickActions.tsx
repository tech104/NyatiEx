import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function QuickActions() {
  const actions = [
    { 
      icon: ArrowDownToLine, 
      label: "Deposit", 
      description: "Add funds",
      variant: "primary" as const,
      path: "/exchange?action=buy"
    },
    { 
      icon: ArrowUpFromLine, 
      label: "Withdraw", 
      description: "Cash out",
      variant: "destructive" as const,
      path: "/exchange?action=sell"
    },
    { 
      icon: ArrowLeftRight, 
      label: "Exchange", 
      description: "Swap crypto",
      variant: "secondary" as const,
      path: "/exchange"
    },
    { 
      icon: QrCode, 
      label: "Receive", 
      description: "Get address",
      variant: "secondary" as const,
      path: "/wallet"
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Link key={action.label} to={action.path}>
          <Button
            variant={action.variant === "primary" ? "default" : action.variant === "destructive" ? "destructive" : "secondary"}
            className={`w-full h-auto py-6 flex flex-col gap-2 ${
              action.variant === "primary" ? "glow-primary" : ""
            }`}
          >
            <action.icon className="w-6 h-6" />
            <span className="font-semibold">{action.label}</span>
            <span className="text-xs opacity-80">{action.description}</span>
          </Button>
        </Link>
      ))}
    </div>
  );
}
