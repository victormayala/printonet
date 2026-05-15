import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code, Copy, Zap } from "lucide-react";
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

const { sessionId, status, designOutput } = await response.json();`;

  const productDataSchema = `// Product Data Schema
{
  name: string,
  category?: string,
  description?: string,
  image_front?: string,
  image_back?: string,
  image_side1?: string,
  image_side2?: string,
  variants?: [{
    color: string,
    colorName: string,
    hex: string
  }]
}`;

  const resultSchema = `// Design Result Schema
{
  sessionId: string,
  sides: [{
    view: 'front' | 'back' | 'side1' | 'side2',
    designPNG: string,
    canvasJSON: string
  }],
  variant: { color: string, colorName: string, hex: string } | null
}`;

  return (
    <div className="bg-background">
      <div className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">Embed the Customizer in Your Store</h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Add product customization to any e-commerce platform in minutes. Feed your product data in,
            get customized design images back — ready for fulfillment.
          </p>
        </div>

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
      </div>
    </div>
  );
}
