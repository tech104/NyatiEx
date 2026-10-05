import { LandingLayout } from "@/components/layout/LandingLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, QrCode, Search, Plus, Wallet as WalletIcon, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const assets = [
  { icon: "₿", name: "Bitcoin", symbol: "BTC", balance: 1.2453, value: 52847.32, change: 2.45, iconBg: "bg-orange-100" },
  { icon: "Ξ", name: "Ethereum", symbol: "ETH", balance: 8.521, value: 18432.12, change: -1.23, iconBg: "bg-blue-100" },
  { icon: "◎", name: "Solana", symbol: "SOL", balance: 145.32, value: 14532.00, change: 5.67, iconBg: "bg-purple-100" },
  { icon: "$", name: "USDT", symbol: "USDT", balance: 5420.00, value: 5420.00, change: 0.01, iconBg: "bg-green-100" },
  { icon: "●", name: "Polkadot", symbol: "DOT", balance: 523.12, value: 3662.84, change: -2.34, iconBg: "bg-pink-100" },
  { icon: "◈", name: "Cardano", symbol: "ADA", balance: 8420.50, value: 4210.25, change: 1.87, iconBg: "bg-blue-100" },
];

const walletAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f12820";

const Wallet = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAssets = assets.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast.success("Wallet address copied to clipboard");
  };

  const totalBalance = assets.reduce((sum, asset) => sum + asset.value, 0);

  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-8 md:py-16 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Nyati <span className="text-primary">Wallet</span>
          </h1>
          <p className="text-muted-foreground">
            Manage your crypto assets securely
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Balance Card */}
          <Card className="border border-border card-shadow bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="icon-container-amber">
                    <WalletIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Balance</p>
                    <p className="font-display text-3xl font-bold">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-nyati-green">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">+3.24%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Wallet Address Card */}
          <Card className="border border-border card-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold">Wallet Address</h3>
                <Button variant="outline" size="sm" className="gap-2 rounded-full">
                  <QrCode className="w-4 h-4" />
                  Show QR
                </Button>
              </div>
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                <code className="flex-1 text-sm text-muted-foreground font-mono truncate">
                  {walletAddress}
                </code>
                <Button variant="ghost" size="icon" onClick={copyAddress}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Use this address to receive crypto. Sending to the wrong network may result in permanent loss.
              </p>
            </CardContent>
          </Card>

          {/* Assets List */}
          <Card className="border border-border card-shadow">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="font-display text-lg">Your Assets</CardTitle>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full sm:w-64 bg-muted/50"
                  />
                </div>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="all" className="w-full">
                <div className="px-6 border-b border-border">
                  <TabsList className="bg-transparent p-0 gap-6">
                    <TabsTrigger 
                      value="all" 
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
                    >
                      All Assets
                    </TabsTrigger>
                    <TabsTrigger 
                      value="tokens" 
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
                    >
                      Tokens
                    </TabsTrigger>
                    <TabsTrigger 
                      value="stablecoins" 
                      className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
                    >
                      Stablecoins
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="all" className="mt-0">
                  {filteredAssets.length > 0 ? (
                    filteredAssets.map((asset) => (
                      <div key={asset.symbol} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${asset.iconBg} flex items-center justify-center text-lg font-bold`}>
                            {asset.icon}
                          </div>
                          <div>
                            <p className="font-semibold">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">{asset.symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{asset.balance.toLocaleString()} {asset.symbol}</p>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm text-muted-foreground">
                              ${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className={`text-xs flex items-center ${asset.change >= 0 ? 'text-nyati-green' : 'text-nyati-red'}`}>
                              {asset.change >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                              {Math.abs(asset.change)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      No assets found matching "{searchQuery}"
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="tokens" className="mt-0">
                  {filteredAssets.filter(a => a.symbol !== "USDT").map((asset) => (
                    <div key={asset.symbol} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${asset.iconBg} flex items-center justify-center text-lg font-bold`}>
                          {asset.icon}
                        </div>
                        <div>
                          <p className="font-semibold">{asset.name}</p>
                          <p className="text-sm text-muted-foreground">{asset.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{asset.balance.toLocaleString()} {asset.symbol}</p>
                        <span className="text-sm text-muted-foreground">
                          ${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="stablecoins" className="mt-0">
                  {filteredAssets.filter(a => a.symbol === "USDT").map((asset) => (
                    <div key={asset.symbol} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${asset.iconBg} flex items-center justify-center text-lg font-bold`}>
                          {asset.icon}
                        </div>
                        <div>
                          <p className="font-semibold">{asset.name}</p>
                          <p className="text-sm text-muted-foreground">{asset.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{asset.balance.toLocaleString()} {asset.symbol}</p>
                        <span className="text-sm text-muted-foreground">
                          ${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </LandingLayout>
  );
};

export default Wallet;
