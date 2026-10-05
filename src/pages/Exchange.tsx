import { LandingLayout } from "@/components/layout/LandingLayout";
import { ExchangeCard } from "@/components/exchange/ExchangeCard";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Exchange = () => {
  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-8 md:py-16 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Sell <span className="text-primary">USDT</span> for <span className="text-nyati-green">KES</span>
          </h1>
          <p className="text-muted-foreground mb-6">
            Send USDT from any wallet and receive KES on M-Pesa instantly
          </p>
          
          {/* No Account Badge */}
          <Badge variant="outline" className="px-5 py-2.5 rounded-full border-primary/30 bg-primary/5">
            <Shield className="w-4 h-4 mr-2 text-primary" />
            <span className="text-primary font-medium">No account required</span>
          </Badge>
        </div>

        {/* Exchange Card */}
        <div className="max-w-lg mx-auto">
          <ExchangeCard />
        </div>

        {/* Transaction Lookup Link */}
        <div className="text-center mt-6">
          <Link to="/transactions" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Look up a past transaction →
          </Link>
        </div>
      </div>
    </LandingLayout>
  );
};

export default Exchange;
