import { Smartphone, Wallet, Zap, ArrowRight } from "lucide-react";

const steps = [
  {
    number: 1,
    icon: Smartphone,
    title: "Enter Your Amount",
    description: "Choose how much to buy or sell - no account needed for amounts up to $10,000",
    iconBg: "bg-nyati-amber-light",
    iconColor: "text-primary",
  },
  {
    number: 2,
    icon: Wallet,
    title: "Pay with M-Pesa or Crypto",
    description: "Send payment via M-Pesa mobile money or transfer crypto wallet-to-wallet across networks",
    iconBg: "bg-nyati-green-light",
    iconColor: "text-nyati-teal",
  },
  {
    number: 3,
    icon: Zap,
    title: "Receive Instantly",
    description: "USDT arrives in your wallet or KES to your M-Pesa within minutes",
    iconBg: "bg-nyati-green-light",
    iconColor: "text-nyati-green",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            How It <span className="text-primary">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Start trading crypto instantly - no account required for exchanges up to $10,000
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="bg-card rounded-2xl border border-border p-8 text-center card-shadow card-shadow-hover h-full">
                <div className={`${step.iconBg} w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4`}>
                  <step.icon className={`w-7 h-7 ${step.iconColor}`} />
                </div>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-sm font-semibold text-muted-foreground">
                  {step.number}
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {/* Arrow between cards */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                  <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
