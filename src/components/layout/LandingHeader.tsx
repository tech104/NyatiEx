import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import nyatiLogo from "@/assets/nyati-logo.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ContactDialog } from "@/components/contact/ContactDialog";


export function LandingHeader() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    // { path: "/exchange", label: "Exchange" },
    // { path: "/wallet", label: "Wallet" }, // Phase 2
    // { path: "/kyc", label: "KYC" },
  ];

  const scrollToFooter = (e: React.MouseEvent) => {
    e.preventDefault();
    document.querySelector("footer")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/70 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={nyatiLogo} alt="Nyati Logo" className="w-9 h-9 rounded-full" />
          <span className="font-serif-display text-xl font-bold tracking-wide text-foreground">
            NYATI
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop User Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth">
            <Button size="sm" className="rounded-full px-5 h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
              Signup
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setContactOpen(true)}
            className="rounded-full px-5 h-10 border-border bg-transparent hover:bg-muted"
          >
            Contact Us
          </Button>

        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="sm" className="p-2">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <div className="flex flex-col gap-8 mt-8">
              <nav className="flex flex-col gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors ${
                      isActive(item.path)
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex flex-col gap-3">
                <Link to="/auth" onClick={() => setIsOpen(false)}>
                  <Button className="w-full rounded-full h-11 font-semibold">Signup</Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full rounded-full h-11"
                  onClick={() => {
                    setIsOpen(false);
                    setContactOpen(true);
                  }}
                >
                  Contact Us
                </Button>
              </div>
              {/* <div className="border-t border-border pt-6 flex flex-col gap-3">
                <Button variant="outline" className="w-full rounded-full gap-2 justify-center">
                  <User className="w-4 h-4" />
                  demo
                </Button>
                <Button variant="ghost" className="w-full gap-2 text-muted-foreground justify-center">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div> */}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </header>

  );
}
