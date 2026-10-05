import { TrendingUp, TrendingDown, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  totalBalance: number;
  percentageChange: number;
  currency?: string;
}

export function BalanceCard({ totalBalance, percentageChange, currency = "USD" }: BalanceCardProps) {
  const [visible, setVisible] = useState(true);
  const isPositive = percentageChange >= 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-border card-hover overflow-hidden relative">
      {/* Background glow effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-crypto-green/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-crypto-blue/10 rounded-full blur-2xl" />
      
      <CardContent className="p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-muted-foreground text-sm font-medium">Total Balance</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
        </div>
        
        <div className="mb-4">
          <h2 className="text-4xl font-display font-bold text-foreground">
            {visible ? formatCurrency(totalBalance) : "••••••••"}
          </h2>
        </div>

        <div className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
          isPositive 
            ? "bg-crypto-green/10 text-crypto-green" 
            : "bg-crypto-red/10 text-crypto-red"
        )}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{isPositive ? "+" : ""}{percentageChange.toFixed(2)}%</span>
          <span className="text-muted-foreground ml-1">24h</span>
        </div>
      </CardContent>
    </Card>
  );
}
