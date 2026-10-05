import { Users, ArrowLeftRight, Shield, Zap } from "lucide-react";

const stats = [
  { icon: Users, label: "Active Users", value: "10,000+", color: "text-primary" },
  { icon: ArrowLeftRight, label: "Volume Traded (KES)", value: "50M+", color: "text-nyati-green" },
  { icon: Shield, label: "Uptime", value: "99.9%", color: "text-primary" },
  { icon: Zap, label: "Avg. Transaction", value: "30s", color: "text-primary" },
];

export function StatsSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">
            Trusted Platform
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Numbers That <span className="text-primary">Speak</span>
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-2xl border border-border p-6 text-center card-shadow card-shadow-hover"
            >
              <div className="icon-container-amber mx-auto mb-4">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
              <div className={`font-display text-3xl md:text-4xl font-bold ${stat.color} mb-2`}>
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
