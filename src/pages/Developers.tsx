import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code, Copy, Download, ShoppingCart, CheckCircle2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UniversalSnippetDialog } from "@/components/UniversalSnippetDialog";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

function CodeBlock({ code, language = "html" }: { code: string; language?: string }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="relative group rounded-lg border border-border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted">
        <span className="text-xs font-mono text-muted-foreground">{language}</span>
        <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 gap-1.5 text-xs">
          <Copy className="h-3 w-3" /> Copy
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Developers() {
  const [activeTab, setActiveTab] = useState<"woocommerce" | "api">("woocommerce");
  const baseUrl = window.location.origin;


  const apiCreateSession = `// Create a customization session
const response = await fetch('${SUPABASE_URL}/functions/v1/create-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product: {
      name: 'Premium Hoodie',
      category: 'Hoodies',
      image_front: 'https://your-cdn.com/hoodie-front.png',
      image_back: 'https://your-cdn.com/hoodie-back.png',
      variants: [
        { color: 'black', colorName: 'Black', hex: '#1a1a1a' }
      ]
    },
    external_ref: 'your-internal-product-id-123'
  })
});

const { sessionId, customizerUrl } = await response.json();
// Open customizerUrl in iframe or redirect user to it`;

  const apiGetSession = `// Retrieve completed session
const response = await fetch(
  '${SUPABASE_URL}/functions/v1/complete-session?sessionId=SESSION_ID'
);

const { sessionId, status, designOutput } = await response.json();
// designOutput.sides[] contains:
//   - view: 'front' | 'back' | 'side1' | 'side2'
//   - designPNG: public URL of the exported design image
//   - canvasJSON: Fabric.js canvas state for re-editing`;

  const productDataSchema = `// Product Data Schema
{
  name: string,          // Required — product name
  category?: string,     // Optional — e.g. 'T-Shirts', 'Hoodies'
  description?: string,  // Optional — product description
  image_front?: string,  // URL — front view mockup image
  image_back?: string,   // URL — back view mockup image
  image_side1?: string,  // URL — side 1 view mockup image
  image_side2?: string,  // URL — side 2 view mockup image
  variants?: [{          // Optional — color variants
    color: string,       // Identifier — e.g. 'white'
    colorName: string,   // Display name — e.g. 'White'
    hex: string          // Hex color — e.g. '#FFFFFF'
  }]
}`;

  const resultSchema = `// Design Result Schema (returned via onComplete / postMessage)
{
  sessionId: string,
  sides: [{
    view: 'front' | 'back' | 'side1' | 'side2',
    designPNG: string,   // Public URL of exported design PNG
    canvasJSON: string    // Fabric.js JSON for re-editing
  }],
  variant: {             // Selected variant (or null)
    color: string,
    colorName: string,
    hex: string
  } | null
}`;

  const tabs = [
    { id: "woocommerce" as const, label: "WooCommerce" },
    { id: "api" as const, label: "API Reference" },
  ];

  const wooInstallSteps = [
    { title: "Download the Plugin", desc: "Click the download button below to get the plugin file." },
    { title: "Upload to WordPress", desc: "Go to WordPress admin → Plugins → Add New → Upload Plugin, and upload the downloaded file." },
    { title: "Activate", desc: "Click 'Activate' after the upload completes." },
    { title: "Configure", desc: "Go to WooCommerce → Customizer Studio. Enter your Base URL, API URL, and Anon Key." },
    { title: "Enable Products", desc: "Edit any WooCommerce product → find the 'Customizer Studio' meta box → check 'Enable Customizer' and enter the matching Product ID or Name." },
  ];

  const handleDownloadPlugin = () => {
    const link = document.createElement('a');
    link.href = baseUrl + '/customizer-studio-woocommerce.php';
    link.download = 'customizer-studio-woocommerce.php';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Plugin downloaded!");
  };

  return (
    <div className="bg-background">
      <div className="p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Intro */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">Embed the Customizer in Your Store</h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Add product customization to any e-commerce platform in minutes. Feed your product data in,
            get customized design images back — ready for fulfillment.
          </p>
        </div>

        {/* Universal Embed Script — quick action */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold">Universal Embed Script</h3>
            <p className="text-sm text-muted-foreground">
              One script tag — every active product gets a customizer button automatically. No per-product setup.
            </p>
          </div>
          <UniversalSnippetDialog />
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: "1", title: "Create Session", desc: "Send your product data (name, images, variants) to our API to get a customizer URL." },
            { step: "2", title: "Customer Designs", desc: "The customizer opens in an iframe/popup. Your customer adds text, images, shapes." },
            { step: "3", title: "Get Results", desc: "Receive high-res PNG exports and design data back via callback or API." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border border-border bg-card p-5 space-y-2">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                {item.step}
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "woocommerce" && (
          <div className="space-y-8">
            {/* Hero card */}
            <div className="rounded-xl border border-border bg-card p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-2xl font-bold">WooCommerce Plugin</h3>
                <p className="text-muted-foreground">
                  One plugin does everything — auto-injects scripts, adds "Customize" buttons to product pages, 
                  saves designs to cart & orders, and fully supports both simple and variable products. 
                  No code editing required.
                </p>
              </div>
              <Button size="lg" onClick={handleDownloadPlugin} className="gap-2 shrink-0">
                <Download className="h-4 w-4" />
                Download Plugin
              </Button>
            </div>

            {/* Features grid */}
            <div>
              <h3 className="text-xl font-semibold mb-4">What's Included</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { title: "Auto Script Injection", desc: "SDK & Loader scripts are automatically added to your store — no manual <script> tags needed." },
                  { title: "Settings Page", desc: "Configure your API credentials directly in WooCommerce → Customizer Studio." },
                  { title: "Product Mapping", desc: "Link WooCommerce products to Customizer Studio products via a meta box in the product editor." },
                  { title: "Customize Button", desc: "Automatically injects a 'Customize' button on enabled product pages. Configurable position." },
                  { title: "Simple Product Support", desc: "One-click add-to-cart with design image and session ID saved as cart metadata." },
                  { title: "Variable Product Support", desc: "Auto-maps the selected color variant to the correct WooCommerce variation and adds to cart via AJAX." },
                  { title: "Cart Image Replacement", desc: "Replaces default product thumbnails in the cart with the customer's custom design preview." },
                  { title: "Order & Email Integration", desc: "Design preview and session ID appear in admin order details and customer confirmation emails." },
                ].map((feature) => (
                  <div key={feature.title} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">{feature.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{feature.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Installation steps */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Installation</h3>
              <div className="space-y-3">
                {wooInstallSteps.map((step, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-sm text-muted-foreground">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration + Copy All */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Configuration</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const creds = `Base URL: ${baseUrl}\nAPI URL: ${SUPABASE_URL}/functions/v1\nAnon Key: ${ANON_KEY}`;
                    navigator.clipboard.writeText(creds);
                    toast.success("All credentials copied to clipboard!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy All Credentials
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Setting</th>
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                      <th className="text-left px-4 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-2 font-mono text-xs">Base URL</td>
                      <td className="px-4 py-2 text-muted-foreground">Your Customizer Studio URL</td>
                      <td className="px-4 py-2 font-mono text-xs cursor-pointer hover:text-primary" onClick={() => { navigator.clipboard.writeText(baseUrl); toast.success("Base URL copied!"); }}>{baseUrl}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono text-xs">API URL</td>
                      <td className="px-4 py-2 text-muted-foreground">Backend API endpoint</td>
                      <td className="px-4 py-2 font-mono text-xs cursor-pointer hover:text-primary" onClick={() => { navigator.clipboard.writeText(`${SUPABASE_URL}/functions/v1`); toast.success("API URL copied!"); }}>{SUPABASE_URL}/functions/v1</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono text-xs">Anon Key</td>
                      <td className="px-4 py-2 text-muted-foreground">Public key for product fetching</td>
                      <td className="px-4 py-2 font-mono text-xs cursor-pointer hover:text-primary truncate max-w-[200px]" onClick={() => { navigator.clipboard.writeText(ANON_KEY); toast.success("Anon Key copied!"); }} title={ANON_KEY}>{ANON_KEY.slice(0, 20)}...{ANON_KEY.slice(-8)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono text-xs">Button Label</td>
                      <td className="px-4 py-2 text-muted-foreground">Customize button text</td>
                      <td className="px-4 py-2 font-mono text-xs">🎨 Customize This Product</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono text-xs">Button Position</td>
                      <td className="px-4 py-2 text-muted-foreground">Where the button appears</td>
                      <td className="px-4 py-2 font-mono text-xs">Before / After Add to Cart</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click any value to copy it individually.</p>
            </div>

            {/* Download CTA */}
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-3">
              <p className="text-muted-foreground">Ready to add product customization to your WooCommerce store?</p>
              <Button size="lg" onClick={handleDownloadPlugin} className="gap-2">
                <Download className="h-4 w-4" />
                Download Plugin
              </Button>
            </div>
          </div>
        )}


        {activeTab === "api" && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">POST /create-session</h3>
              <p className="text-muted-foreground">Create a new customization session. Returns a session ID and customizer URL.</p>
              <CodeBlock code={apiCreateSession} language="javascript" />
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">GET /complete-session</h3>
              <p className="text-muted-foreground">Retrieve a completed session's design output.</p>
              <CodeBlock code={apiGetSession} language="javascript" />
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Product Data Schema</h3>
              <CodeBlock code={productDataSchema} language="typescript" />
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Design Result Schema</h3>
              <CodeBlock code={resultSchema} language="typescript" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
