import MarketingLayout from "@/components/MarketingLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What platforms does Customizer Studio work with?",
    a: "Customizer Studio is platform-agnostic. It works with Shopify, WooCommerce, custom-built stores, and any platform that can render HTML and JavaScript. Our SDK integrates via iframe or script tag.",
  },
  {
    q: "Do I need coding experience to set up the customizer?",
    a: "Not necessarily. For Shopify and WooCommerce, we offer zero-code integration via our Universal Loader script. For custom setups, basic JavaScript knowledge is helpful but our documentation walks you through every step.",
  },
  {
    q: "What file formats are exported?",
    a: "Designs are exported as high-resolution PNG files at 4× resolution (150+ DPI) — ready for professional printing. You also receive the full canvas JSON data for re-editing.",
  },
  {
    q: "Can I white-label the customizer?",
    a: "Yes. Pro and Enterprise plans include full white-labeling — custom logos, brand colors, fonts, and themes. Your customers will see your brand throughout the design experience.",
  },
  {
    q: "How does supplier integration work?",
    a: "Connect your S&S Activewear or SanMar account to browse and import blank products directly into your catalog — complete with colors, sizes, pricing, and product images.",
  },
  {
    q: "Is there a limit on the number of products?",
    a: "The Starter plan supports up to 5 products. Pro and Enterprise plans offer unlimited products with no restrictions.",
  },
  {
    q: "How does the AI design assistant work?",
    a: "Our built-in AI can generate designs from text prompts, remove image backgrounds, and upscale artwork — all directly within the design studio. No external tools needed.",
  },
  {
    q: "Can customers save and return to their designs?",
    a: "Yes. Each design session is stored with a unique ID. Customers can return to their design via a direct link, and store owners can view all sessions from the dashboard.",
  },
  {
    q: "What payment methods are supported?",
    a: "The hosted checkout flow is powered by Stripe, supporting credit cards, Apple Pay, Google Pay, and other popular payment methods.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes! The Starter plan is free forever with core features. Pro plans include a free trial period so you can test everything before committing.",
  },
];

export default function Faq() {
  return (
    <MarketingLayout>
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              Frequently asked{" "}
              <span className="text-gradient">questions</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Everything you need to know about Customizer Studio.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-xl border bg-card px-6 data-[state=open]:shadow-md transition-shadow"
                >
                  <AccordionTrigger className="text-left font-display font-semibold text-[15px] hover:no-underline py-5">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
