import { TrendingUp, TrendingDown } from "lucide-react";

const cryptoData = [
  { symbol: "ETH", name: "Ethereum", price: 3928.39, change: 1.96, icon: "Ξ", iconBg: "bg-blue-100" },
  { symbol: "USDT", name: "Tether", price: 0.98, change: -0.21, icon: "₮", iconBg: "bg-green-100" },
  { symbol: "BNB", name: "BNB", price: 706.31, change: -0.36, icon: "◆", iconBg: "bg-yellow-100" },
  { symbol: "SOL", name: "Solana", price: 226.32, change: 2.68, icon: "◎", iconBg: "bg-purple-100" },
  { symbol: "XRP", name: "Ripple", price: 2.44, change: -0.83, icon: "✕", iconBg: "bg-gray-100" },
  { symbol: "BTC", name: "Bitcoin", price: 97245.12, change: 3.24, icon: "₿", iconBg: "bg-orange-100" },
  { symbol: "ADA", name: "Cardano", price: 0.89, change: -1.12, icon: "◇", iconBg: "bg-blue-100" },
  { symbol: "DOGE", name: "Dogecoin", price: 0.32, change: 5.67, icon: "Ð", iconBg: "bg-yellow-100" },
];

function TickerItem({ crypto }: { crypto: typeof cryptoData[0] }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 bg-card rounded-xl border border-border card-shadow min-w-[200px] shrink-0">
      <div className={`w-10 h-10 rounded-lg ${crypto.iconBg} flex items-center justify-center text-lg font-bold`}>
        {crypto.icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{crypto.symbol}</span>
          <span className="text-xs text-muted-foreground">{crypto.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">
            ${crypto.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`flex items-center text-xs ${crypto.change >= 0 ? 'text-nyati-green' : 'text-nyati-red'}`}>
            {crypto.change >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
            {Math.abs(crypto.change)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function CryptoTicker() {
  return (
    <section className="py-8 overflow-hidden">
      <div className="relative w-full">
        {/* Gradient masks for seamless fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        
        {/* Marquee container */}
        <div className="flex animate-marquee">
          {/* First set of items */}
          <div className="flex gap-4 shrink-0">
            {cryptoData.map((crypto) => (
              <TickerItem key={crypto.symbol} crypto={crypto} />
            ))}
          </div>
          {/* Duplicate set for seamless loop */}
          <div className="flex gap-4 shrink-0 ml-4">
            {cryptoData.map((crypto) => (
              <TickerItem key={`${crypto.symbol}-dup`} crypto={crypto} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
