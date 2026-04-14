import MarketingLayout from "@/components/MarketingLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Heart, Rocket } from "lucide-react";

const values = [
  { icon: Target, title: "Platform Agnostic", desc: "We believe product customization shouldn't be locked to a single e-commerce platform. Our tool works everywhere." },
  { icon: Heart, title: "Creator First", desc: "Built for store owners, print shops, and entrepreneurs who want to offer personalized products without the complexity." },
  { icon: Rocket, title: "Ship Fast", desc: "From blank product to customized, print-ready output in minutes. We optimize every step of the workflow." },
];

export default function About() {
  return (
    <MarketingLayout>
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              About{" "}
              <span className="text-gradient">Customizer Studio</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              We're building the easiest way to add product customization to any online store — from t-shirts and mugs to phone cases and tote bags.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-8 mb-20">
            <div className="rounded-2xl border bg-card p-10">
              <h2 className="font-display text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                Product personalization drives 20-30% higher conversion rates and significantly reduces returns. Yet most customization tools are clunky, expensive, or locked to a single platform. Customizer Studio changes that. We provide a rich, embeddable design editor that works with any e-commerce setup — letting store owners offer custom products in minutes, not months.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
            {values.map((v) => (
              <div key={v.title} className="rounded-xl border bg-card p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link to="/contact">
              <Button size="lg" className="gap-2">
                Get in Touch <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
