import { Zap, ShieldCheck, Globe, Smartphone, Clock, TrendingUp, ChevronRight } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant Settlement",
    description: "Funds in seconds",
    iconBg: "bg-nyati-amber-light",
    iconColor: "text-primary",
  },
  {
    icon: ShieldCheck,
    title: "Bank-Grade Security",
    description: "Your assets protected",
    iconBg: "bg-nyati-teal-light",
    iconColor: "text-nyati-teal",
  },
  {
    icon: Globe,
    title: "Global Access",
    description: "Trade anywhere",
    iconBg: "bg-nyati-purple-light",
    iconColor: "text-nyati-purple",
  },
  {
    icon: Smartphone,
    title: "M-Pesa Native",
    description: "Pay with M-Pesa",
    iconBg: "bg-nyati-amber-light",
    iconColor: "text-primary",
  },
  {
    icon: Clock,
    title: "24/7 Support",
    description: "Always here",
    iconBg: "bg-nyati-teal-light",
    iconColor: "text-nyati-teal",
  },
  {
    icon: TrendingUp,
    title: "Best Rates",
    description: "Competitive pricing",
    iconBg: "bg-nyati-purple-light",
    iconColor: "text-nyati-purple",
  },
];

export function FeaturesGridSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Everything You <span className="text-primary">Need</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Click on any feature to learn more about how we make crypto trading simple
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-2xl border border-border p-6 card-shadow card-shadow-hover group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${feature.iconBg} w-12 h-12 rounded-xl flex items-center justify-center`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
