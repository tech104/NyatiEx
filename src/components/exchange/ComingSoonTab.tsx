import { Badge } from "@/components/ui/badge";
import { Bell, Rocket } from "lucide-react";

export function ComingSoonTab() {
  return (
    <div className="py-12 text-center space-y-4 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <Rocket className="w-8 h-8 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold">Buy USDT Coming Soon</h3>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto">
        Pay with M-Pesa and receive USDT directly to your wallet. 
        This feature is launching very soon!
      </p>
      <Badge variant="outline" className="px-4 py-2 border-primary/30 bg-primary/5">
        <Bell className="w-3 h-3 mr-2" />
        Launching Q3 2025
      </Badge>
    </div>
  );
}
