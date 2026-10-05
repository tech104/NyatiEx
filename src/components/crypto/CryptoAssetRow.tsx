import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CryptoAssetRowProps {
  icon: string;
  name: string;
  symbol: string;
  balance: number;
  value: number;
  change: number;
  color?: string;
}

export function CryptoAssetRow({ icon, name, symbol, balance, value, change, color }: CryptoAssetRowProps) {
  const isPositive = change >= 0;

  return (
    <div className="flex items-center justify-between py-4 px-4 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
          style={{ backgroundColor: color ? `${color}20` : 'hsl(var(--muted))' }}
        >
          {icon}
        </div>
        <div>
          <p className="font-semibold text-foreground">{name}</p>
          <p className="text-sm text-muted-foreground">{symbol}</p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-semibold text-foreground">
          {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {symbol}
        </p>
        <p className="text-sm text-muted-foreground">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className={cn(
        "flex items-center gap-1 min-w-[80px] justify-end",
        isPositive ? "text-crypto-green" : "text-crypto-red"
      )}>
        {isPositive ? (
          <TrendingUp className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
        <span className="font-medium">{isPositive ? "+" : ""}{change.toFixed(2)}%</span>
      </div>
    </div>
  );
}
