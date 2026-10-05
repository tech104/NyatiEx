import { ExchangeCard } from "@/components/exchange/ExchangeCard";

export function HeroSection() {
  return (
    <section className="relative py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left: copy */}
          <div className="space-y-8">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-full">
              Private Client Liquidity
            </span>

            <h1 className="font-serif-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] text-foreground">
              Seamless<br />
              <span className="text-primary italic">On-Ramp &amp;<br />Off-Ramp.</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Convert USDT or USDC to KES in seconds with secure execution, transparent rates,
              and institutional-grade settlement rails built for modern digital asset clients.
            </p>

            <div className="inline-flex rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
              <div className="px-6 py-4 border-r border-border">
                <div className="font-serif-display text-2xl md:text-3xl font-bold text-foreground">$12B+</div>
                <div className="text-xs text-muted-foreground mt-1">Quarterly Volume</div>
              </div>
              <div className="px-6 py-4 border-r border-border">
                <div className="font-serif-display text-2xl md:text-3xl font-bold text-foreground">&lt;10ms</div>
                <div className="text-xs text-muted-foreground mt-1">Execution Latency</div>
              </div>
              <div className="px-6 py-4">
                <div className="font-serif-display text-2xl md:text-3xl font-bold text-foreground">MPC</div>
                <div className="text-xs text-muted-foreground mt-1">Custody</div>
              </div>
            </div>
          </div>

          {/* Right: exchange card */}
          <div className="lg:pl-4">
            <ExchangeCard />
          </div>
        </div>
      </div>
    </section>
  );
}
