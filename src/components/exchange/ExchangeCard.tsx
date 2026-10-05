import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, RefreshCw } from "lucide-react";
import { SellForm } from "./SellForm";
import { BuyForm } from "./BuyForm";

export function ExchangeCard() {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");

  return (
    <Card className="border border-border card-shadow">
      <CardContent className="p-6">
        {/* Security Badge */}
        <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>Secured by Smart Contract Escrow</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "buy" | "sell")} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-xl p-1">
            <TabsTrigger value="buy" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Buy USDT
            </TabsTrigger>
            <TabsTrigger value="sell" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Sell USDT
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="mt-6">
            <BuyForm />
          </TabsContent>

          <TabsContent value="sell" className="mt-6">
            <SellForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
