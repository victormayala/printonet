import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogIn, Menu, X } from "lucide-react";
import logo from "@/assets/customizer-studio-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", to: "/faq" },
];

const footerLinks = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", to: "/faq" },
  { label: "Integrations", to: "/integrations" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="Customizer Studio" className="h-10" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-[15px] font-medium transition-colors hover:text-foreground ${
                  location.pathname === link.to
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/products">
                <Button className="rounded-full px-6 h-11 bg-foreground text-background hover:bg-foreground/90 font-semibold">
                  Dashboard <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth" className="hidden sm:block">
                  <Button variant="ghost" className="text-[15px] font-medium text-muted-foreground hover:text-foreground">
                    <LogIn className="h-4 w-4 mr-1.5" /> Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button className="rounded-full px-6 h-11 bg-foreground text-background hover:bg-foreground/90 font-semibold">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-background px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-3 rounded-lg text-[15px] font-medium transition-colors ${
                  location.pathname === link.to
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container py-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {footerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t">
          <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Customizer Studio" className="h-6 opacity-60" />
            </Link>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Customizer Studio
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
