import { Zap, Shield, Clock } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant Transactions",
    description: "Your crypto arrives in seconds after M-Pesa confirmation",
    iconBg: "bg-nyati-amber-light",
    iconColor: "text-primary",
  },
  {
    icon: Shield,
    title: "Secure & Trusted",
    description: "Bank-grade security protecting your funds 24/7",
    iconBg: "bg-nyati-teal-light",
    iconColor: "text-nyati-teal",
  },
  {
    icon: Clock,
    title: "24/7 Support",
    description: "Our team is always here to help you trade",
    iconBg: "bg-nyati-purple-light",
    iconColor: "text-nyati-purple",
  },
];

export function WhyNyatiSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Why <span className="text-primary">Nyati</span>?
          </h2>
          <p className="text-muted-foreground">
            The trusted way to trade crypto in Kenya
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-2xl border border-border p-8 card-shadow card-shadow-hover"
            >
              <div className={`${feature.iconBg} w-14 h-14 rounded-xl flex items-center justify-center mb-6`}>
                <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">
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
