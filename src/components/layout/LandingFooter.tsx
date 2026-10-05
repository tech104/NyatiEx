import { Link } from "react-router-dom";
import { Linkedin, Mail, Phone, Heart } from "lucide-react";
import nyatiLogo from "@/assets/nyati-logo.png";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={nyatiLogo} alt="Nyati Logo" className="w-10 h-10" />
              <span className="font-display text-xl font-semibold">
                Nyati<span className="text-primary">.</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Empowering individuals and businesses across Africa with seamless fiat-to-crypto exchange solutions.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://www.linkedin.com/company/nyatiex/posts/?feedView=all" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors" aria-label="LinkedIn">
                <Linkedin className="w-4 h-4 text-muted-foreground" />
              </a>
              <a href="mailto:info@nyatiex.com" className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors" aria-label="Email">
                <Mail className="w-4 h-4 text-muted-foreground" />
              </a>
              <a href="https://wa.me/254746973276" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors" aria-label="WhatsApp">
                <Phone className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/exchange" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Buy Crypto
                </Link>
              </li>
              <li>
                <Link to="/exchange" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sell Crypto
                </Link>
              </li>
              <li>
                <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Live Rates
                </Link>
              </li>
              <li>
                <Link to="/wallet" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Nyati Wallet
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:info@nyatiex.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:info@nyatiex.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  info@nyatiex.com
                </a>
              </li>
              <li>
                <a href="tel:+254746973276" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  +254 746 973 276
                </a>
              </li>
              <li>
                <a href="https://wa.me/254746973276" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  WhatsApp +254 746 973 276
                </a>
              </li>
              <li>
                <a href="https://www.linkedin.com/company/nyatiex/posts/?feedView=all" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Nyati Wallet Ltd. All rights reserved.
          </p>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          Made with <Heart className="w-3 h-3 text-destructive fill-destructive" /> in Nairobi, Kenya
        </p>
      </div>
      </div>
    </footer>
  );
}
