import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet, Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>

          {/* Heading */}
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Ready to Join the <span className="text-primary">Future</span>?
          </h2>

          {/* Subtitle */}
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Start trading crypto with M-Pesa in under 2 minutes. No complex setup required.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/wallet">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full glow-primary">
                Open Wallet <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/exchange">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full">
                Buy & Sell Crypto
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
