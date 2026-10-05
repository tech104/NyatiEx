import { LandingLayout } from "@/components/layout/LandingLayout";
import { HeroSection } from "@/components/landing/HeroSection";
// import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
// import { WhyNyatiSection } from "@/components/landing/WhyNyatiSection";
// import { FeaturesGridSection } from "@/components/landing/FeaturesGridSection";
// import { LiveRatesSection } from "@/components/landing/LiveRatesSection";
// import { CTASection } from "@/components/landing/CTASection";

const Index = () => {
  return (
    <LandingLayout>
      <div className="animate-fade-in">
        <HeroSection />
        {/* <HowItWorksSection /> */}
        {/* <WhyNyatiSection /> */}
        {/* <FeaturesGridSection /> */}
        {/* <LiveRatesSection /> */}
        {/* <CTASection /> */}
      </div>
    </LandingLayout>
  );
};

export default Index;
