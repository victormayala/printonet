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
      <section className="py-28 md:py-36">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h1 className="font-display text-5xl md:text-[4.5rem] font-bold tracking-tight leading-[1.05]">
              About Customizer Studio.
            </h1>
            <p className="mt-8 text-lg md:text-xl text-muted-foreground leading-relaxed">
              We're building the easiest way to add product customization to any online store — from t-shirts and mugs to phone cases and tote bags.
            </p>
          </div>

          <div className="max-w-3xl mx-auto mb-20">
            <div className="rounded-2xl border p-10">
              <h2 className="font-display text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                Product personalization drives 20-30% higher conversion rates and significantly reduces returns. Yet most customization tools are clunky, expensive, or locked to a single platform. Customizer Studio changes that. We provide a rich, embeddable design editor that works with any e-commerce setup — letting store owners offer custom products in minutes, not months.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto mb-20">
            {values.map((v) => (
              <div key={v.title} className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link to="/contact">
              <Button className="rounded-full px-8 h-12 font-semibold bg-foreground text-background hover:bg-foreground/90 gap-2">
                Get in Touch <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
