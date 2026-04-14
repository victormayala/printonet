import MarketingLayout from "@/components/MarketingLayout";
import {
  Layers, Globe, Zap, Paintbrush, Type, Image, Shapes, Upload,
  Palette, Undo2, Grid3X3, Printer, ShieldCheck, Code2
} from "lucide-react";

const capabilities = [
  { icon: Type, title: "Custom Typography", desc: "47 curated Google Fonts, arch text, font sizing, letter spacing, and text templates." },
  { icon: Image, title: "Image Upload", desc: "Customers upload logos and artwork with automatic aspect ratio preservation and print-spec guidance." },
  { icon: Shapes, title: "Shapes & Clipart", desc: "90+ SVG clipart icons, geometric shapes, and dynamic patterns — all recolorable in real time." },
  { icon: Layers, title: "Layer Management", desc: "Full layer stack with reordering, locking, opacity control, and grouping for complex designs." },
  { icon: Undo2, title: "Undo & Redo", desc: "Unlimited undo/redo history so customers can experiment freely without losing work." },
  { icon: Palette, title: "Color System", desc: "Unified color picker with presets. One-click recolor for text, shapes, and SVGs." },
  { icon: Grid3X3, title: "Print Areas", desc: "Define precise printable regions for each product side. Designs snap and clamp to boundaries." },
  { icon: Paintbrush, title: "AI Design Assistant", desc: "Generate designs, remove backgrounds, and upscale artwork with built-in AI tools." },
  { icon: Globe, title: "Multi-Platform", desc: "Works with Shopify, WooCommerce, custom stores — any platform that renders HTML." },
  { icon: Code2, title: "Developer SDK", desc: "JavaScript SDK with postMessage callbacks, iframe embedding, and universal loader script." },
  { icon: Printer, title: "Print-Ready Export", desc: "4× high-res PNG export at 150+ DPI. Shareable print URLs for fulfillment partners." },
  { icon: ShieldCheck, title: "White Labeling", desc: "Custom logos, colors, fonts, and themes. Your brand, not ours, on every customer touchpoint." },
  { icon: Upload, title: "Supplier Import", desc: "Import blank products from S&S Activewear and SanMar directly into your catalog." },
  { icon: Zap, title: "Instant Preview", desc: "Real-time mockup rendering. Customers see their design on the product as they build it." },
];

export default function Features() {
  return (
    <MarketingLayout>
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              Everything you need to sell{" "}
              <span className="text-gradient">custom products</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              A full-featured design studio that embeds directly into your store. No separate app, no redirects — just a seamless customization experience.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {capabilities.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border bg-card p-7 transition-all hover:shadow-lg hover:border-primary/30"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
