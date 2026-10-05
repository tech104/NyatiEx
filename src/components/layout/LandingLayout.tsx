import { ReactNode } from "react";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";

interface LandingLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function LandingLayout({ children, showFooter = true }: LandingLayoutProps) {
  return (
    <div className="min-h-screen nyati-gradient-bg">
      <LandingHeader />
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <LandingFooter />}
    </div>
  );
}
