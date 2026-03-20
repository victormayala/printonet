import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";

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
  const [activeTab, setActiveTab] = useState<"quickstart" | "api" | "sdk">("quickstart");
  const baseUrl = window.location.origin;

  const sdkSnippet = `<!-- Add the Customizer SDK -->
<script src="${baseUrl}/customizer-sdk.js"><\/script>

<script>
  // Initialize with your API URL
  CustomizerStudio.init({
    apiUrl: '${SUPABASE_URL}/functions/v1',
    baseUrl: '${baseUrl}'
  });

  // Open the customizer when user clicks "Customize"
  document.getElementById('customize-btn').addEventListener('click', function() {
    CustomizerStudio.open({
      product: {
        name: 'Classic T-Shirt',
        category: 'T-Shirts',
        image_front: 'https://your-store.com/tshirt-front.png',
        image_back: 'https://your-store.com/tshirt-back.png',
        variants: [
          { color: 'white', colorName: 'White', hex: '#FFFFFF' },
          { color: 'black', colorName: 'Black', hex: '#1a1a1a' }
        ]
      },
      externalRef: 'cart-item-123',
      onComplete: function(result) {
        console.log('Design completed!', result);
        // result.sides[] contains designPNG URLs and canvasJSON for each view
        // Add the customized product to your cart here
      },
      onCancel: function() {
        console.log('User cancelled customization');
      }
    });
  });
<\/script>

<button id="customize-btn">Customize This Product</button>`;

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
    { id: "quickstart" as const, label: "Quick Start" },
    { id: "api" as const, label: "API Reference" },
    { id: "sdk" as const, label: "SDK Reference" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Developer Integration</h1>
          </div>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        {/* Intro */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">Embed the Customizer in Your Store</h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Add product customization to any e-commerce platform in minutes. Feed your product data in,
            get customized design images back — ready for fulfillment.
          </p>
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
        {activeTab === "quickstart" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Embed with JavaScript SDK</h3>
              <p className="text-muted-foreground">
                The fastest way to integrate. Add a single script tag and call <code className="text-sm bg-muted px-1.5 py-0.5 rounded">CustomizerStudio.open()</code>.
              </p>
            </div>
            <CodeBlock code={sdkSnippet} language="html" />
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

        {activeTab === "sdk" && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">CustomizerStudio.init(options)</h3>
              <p className="text-muted-foreground">Initialize the SDK with your configuration.</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Option</th>
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr><td className="px-4 py-2 font-mono text-xs">apiUrl</td><td className="px-4 py-2">string</td><td className="px-4 py-2 text-muted-foreground">Base URL of your backend functions</td></tr>
                    <tr><td className="px-4 py-2 font-mono text-xs">baseUrl</td><td className="px-4 py-2">string</td><td className="px-4 py-2 text-muted-foreground">Base URL of the customizer app</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">CustomizerStudio.open(options)</h3>
              <p className="text-muted-foreground">Open the customizer for a product.</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Option</th>
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr><td className="px-4 py-2 font-mono text-xs">product</td><td className="px-4 py-2">object</td><td className="px-4 py-2 text-muted-foreground">Product data (see schema above)</td></tr>
                    <tr><td className="px-4 py-2 font-mono text-xs">externalRef</td><td className="px-4 py-2">string?</td><td className="px-4 py-2 text-muted-foreground">Your internal reference ID</td></tr>
                    <tr><td className="px-4 py-2 font-mono text-xs">onComplete</td><td className="px-4 py-2">function</td><td className="px-4 py-2 text-muted-foreground">Called with design result when user finishes</td></tr>
                    <tr><td className="px-4 py-2 font-mono text-xs">onCancel</td><td className="px-4 py-2">function</td><td className="px-4 py-2 text-muted-foreground">Called when user cancels</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">CustomizerStudio.close()</h3>
              <p className="text-muted-foreground">Programmatically close the customizer overlay.</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">postMessage Events</h3>
              <p className="text-muted-foreground">
                If you prefer manual iframe integration, the customizer posts these events to <code className="bg-muted px-1.5 py-0.5 rounded text-xs">window.parent</code>:
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Event Type</th>
                      <th className="text-left px-4 py-2 font-medium">Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-2 font-mono text-xs">design-complete</td>
                      <td className="px-4 py-2 text-muted-foreground">Design result object with sides, PNGs, JSON</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono text-xs">design-cancel</td>
                      <td className="px-4 py-2 text-muted-foreground">Empty — user cancelled</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                All messages include <code className="bg-muted px-1 py-0.5 rounded">source: "customizer-studio"</code> for filtering.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
