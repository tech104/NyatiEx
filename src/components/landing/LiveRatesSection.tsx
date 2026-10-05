import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

const exchangeRates = {
  KES_USDT: { rate: 0.0077, change: 0.54, inverse: 130.35, inverseChange: -0.27 },
};

const cryptoData = [
  { symbol: "BTC", name: "Bitcoin", price: 103416.28, change: 2.74, icon: "₿", iconBg: "bg-orange-100" },
  { symbol: "ETH", name: "Ethereum", price: 3935.26, change: -1.53, icon: "Ξ", iconBg: "bg-blue-100" },
  { symbol: "USDT", name: "Tether", price: 1.00, change: 0.10, icon: "₮", iconBg: "bg-green-100" },
  { symbol: "BNB", name: "BNB", price: 708.69, change: -1.38, icon: "◆", iconBg: "bg-yellow-100" },
  { symbol: "SOL", name: "Solana", price: 224.80, change: -3.88, icon: "◎", iconBg: "bg-purple-100" },
  { symbol: "XRP", name: "Ripple", price: 2.45, change: -0.85, icon: "✕", iconBg: "bg-gray-100" },
];

export function LiveRatesSection() {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refreshRates = () => {
    setLastUpdated(new Date());
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-16 md:py-24 nyati-gradient-subtle">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 px-4 py-2 rounded-full">
            <RefreshCw className="w-3 h-3 mr-2" />
            Updated every 30 seconds
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Live Exchange <span className="text-primary">Rates</span>
          </h2>
          <p className="text-muted-foreground">
            Get the best value for your money with real-time market rates
          </p>
        </div>

        {/* KES/USDT Exchange Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-10">
          {/* KES to USDT */}
          <div className="bg-card rounded-2xl border border-border p-6 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                  KE
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">FROM</span>
                  <p className="font-semibold">KES</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-primary" />
              <div className="flex items-center gap-2">
                <div className="text-xs text-right">
                  <span className="text-muted-foreground">TO</span>
                  <p className="font-semibold">USDT</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                  ₮
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-2xl font-bold">{exchangeRates.KES_USDT.rate}</p>
                <p className="text-xs text-muted-foreground">1 KES = 0.00767 USDT</p>
              </div>
              <span className="flex items-center text-sm text-nyati-green">
                <TrendingUp className="w-3 h-3 mr-1" />
                {exchangeRates.KES_USDT.change}%
              </span>
            </div>
          </div>

          {/* USDT to KES */}
          <div className="bg-card rounded-2xl border border-border p-6 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                  ₮
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">FROM</span>
                  <p className="font-semibold">USDT</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-primary" />
              <div className="flex items-center gap-2">
                <div className="text-xs text-right">
                  <span className="text-muted-foreground">TO</span>
                  <p className="font-semibold">KES</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                  KE
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-2xl font-bold">{exchangeRates.KES_USDT.inverse}</p>
                <p className="text-xs text-muted-foreground">1 USDT = 130.35 KES</p>
              </div>
              <span className="flex items-center text-sm text-nyati-red">
                <TrendingDown className="w-3 h-3 mr-1" />
                {Math.abs(exchangeRates.KES_USDT.inverseChange)}%
              </span>
            </div>
          </div>
        </div>

        {/* Popular Cryptocurrencies */}
        <div className="text-center mb-6">
          <h3 className="font-display text-xl font-semibold">
            Popular <span className="text-primary">Cryptocurrencies</span>
          </h3>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {cryptoData.map((crypto) => (
            <div
              key={crypto.symbol}
              className="bg-card rounded-xl border border-border p-4 text-center card-shadow min-w-[120px]"
            >
              <div className={`w-10 h-10 rounded-lg ${crypto.iconBg} flex items-center justify-center mx-auto mb-2 text-lg font-bold`}>
                {crypto.icon}
              </div>
              <p className="font-semibold">{crypto.symbol}</p>
              <p className="text-xs text-muted-foreground mb-1">{crypto.name}</p>
              <p className="font-mono text-sm font-medium">
                ${crypto.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className={`text-xs ${crypto.change >= 0 ? 'text-nyati-green' : 'text-nyati-red'}`}>
                {crypto.change >= 0 ? '↗' : '↘'} {Math.abs(crypto.change)}%
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="outline" onClick={refreshRates} className="rounded-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Rates
          </Button>
          <Link to="/exchange">
            <Button className="rounded-full glow-primary">
              Start Trading Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Last Updated */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      </div>
    </section>
  );
}
