import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Sun,
  Moon,
  Paintbrush,
  Type as TypeIcon,
  Palette,
  Image as ImageIcon,
  Sparkles,
  Square,
  Undo2,
  Redo2,
  Upload,
  Layers as LayersIcon,
  Save,
  X,
  Loader2,
} from "lucide-react";
import {
  DEFAULT_BRAND_CONFIG,
  type BrandConfig,
  brandConfigToCSSVars,
} from "@/lib/brand-config";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/customizer-studio-logo.png";

const FONT_OPTIONS = [
  "Inter",
  "Space Grotesk",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Raleway",
  "Source Sans 3",
  "DM Sans",
  "IBM Plex Sans",
  "Work Sans",
  "Outfit",
  "Plus Jakarta Sans",
];

export default function BrandSettings() {
  const [config, setConfig] = useState<BrandConfig>({ ...DEFAULT_BRAND_CONFIG });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedConfigId, setSavedConfigId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing brand config from database on mount
  useEffect(() => {
    async function loadExisting() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoadingConfig(false); return; }

        const { data, error } = await supabase
          .from("brand_configs")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setSavedConfigId(data.id);
          setConfig({
            name: data.name || "",
            logoUrl: data.logo_url || "",
            logoDarkUrl: (data as any).logo_dark_url || "",
            theme: (data.theme === "light" ? "light" : "dark"),
            primaryColor: data.primary_color,
            accentColor: data.accent_color,
            fontFamily: data.font_family,
            borderRadius: data.border_radius,
          });
        }
      } catch (err) {
        console.error("Failed to load brand config:", err);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadExisting();
  }, []);

  // Apply CSS vars to preview container
  useEffect(() => {
    if (!previewRef.current) return;
    const vars = brandConfigToCSSVars(config);
    Object.entries(vars).forEach(([key, value]) => {
      previewRef.current!.style.setProperty(key, value);
    });
  }, [config]);

  function updateConfig(partial: Partial<BrandConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }));
  }

  // Logo upload handler — variant: "light" (regular) or "dark"
  const handleLogoUpload = useCallback(async (file: File, variant: "light" | "dark" = "light") => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, SVG)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `logo_${variant}_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("brand-assets")
        .upload(fileName, file, { contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("brand-assets")
        .getPublicUrl(data.path);

      if (variant === "dark") updateConfig({ logoDarkUrl: urlData.publicUrl });
      else updateConfig({ logoUrl: urlData.publicUrl });
      toast({ title: variant === "dark" ? "Dark-mode logo uploaded" : "Logo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  }, [toast]);

  function handleLogoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleLogoUpload(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoUpload(file);
  }

  function removeLogo() {
    updateConfig({ logoUrl: "" });
  }

  // Save to database
  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        name: config.name || null,
        logo_url: config.logoUrl || null,
        theme: config.theme,
        primary_color: config.primaryColor,
        accent_color: config.accentColor,
        font_family: config.fontFamily,
        border_radius: config.borderRadius,
        user_id: user.id,
      };

      if (savedConfigId) {
        const { error } = await supabase
          .from("brand_configs")
          .update(payload)
          .eq("id", savedConfigId);
        if (error) throw error;
        toast({ title: "Brand settings updated" });
      } else {
        const { data, error } = await supabase
          .from("brand_configs")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setSavedConfigId(data.id);
        toast({ title: "Brand settings saved" });
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function generateSDKCode(): string {
    const brandObj: Record<string, any> = {};
    if (config.name) brandObj.name = config.name;
    if (config.logoUrl) brandObj.logoUrl = config.logoUrl;
    brandObj.theme = config.theme;
    brandObj.primaryColor = config.primaryColor;
    brandObj.accentColor = config.accentColor;
    brandObj.fontFamily = config.fontFamily;
    brandObj.borderRadius = config.borderRadius;

    return `CustomizerStudio.open({
  product: {
    name: 'Your Product',
    image_front: '/product-front.png',
  },
  brand: ${JSON.stringify(brandObj, null, 4)},
  onComplete: (result) => {
    console.log('Design complete:', result);
  }
});`;
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(generateSDKCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Mini preview computed styles
  const previewBg = config.theme === "dark" ? "hsl(240 10% 12%)" : "hsl(0 0% 95%)";
  const previewToolbar = config.theme === "dark" ? "hsl(240 10% 10%)" : "hsl(0 0% 98%)";
  const previewSidebar = config.theme === "dark" ? "hsl(240 10% 8%)" : "hsl(0 0% 98%)";
  const previewText = config.theme === "dark" ? "hsl(240 5% 85%)" : "hsl(240 10% 10%)";
  const previewMuted = config.theme === "dark" ? "hsl(240 4% 55%)" : "hsl(240 4% 46%)";
  const previewBorder = config.theme === "dark" ? "hsl(240 8% 18%)" : "hsl(0 0% 88%)";
  const previewSidebarAccent = config.theme === "dark" ? "hsl(240 8% 14%)" : "hsl(0 0% 94%)";

  return (
    <div className="bg-background">
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold">Brand Settings</h2>
            <p className="mt-1 text-muted-foreground">
              Configure colors, logo, and fonts to match your brand.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : savedConfigId ? "Update" : "Save Settings"}
          </Button>
        </div>

          <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-8">
            {/* Settings Panel */}
            <div className="space-y-6">
              {/* Theme Toggle */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Theme</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig({ theme: "dark" })}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                      config.theme === "dark"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    Dark
                  </button>
                  <button
                    onClick={() => updateConfig({ theme: "light" })}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                      config.theme === "light"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    Light
                  </button>
                </div>
              </div>

              {/* Colors */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Paintbrush className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Colors</h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.primaryColor}
                        onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                        className="h-9 w-9 rounded-lg cursor-pointer border-0"
                      />
                      <Input
                        value={config.primaryColor}
                        onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.accentColor}
                        onChange={(e) => updateConfig({ accentColor: e.target.value })}
                        className="h-9 w-9 rounded-lg cursor-pointer border-0"
                      />
                      <Input
                        value={config.accentColor}
                        onChange={(e) => updateConfig({ accentColor: e.target.value })}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Branding — Logo Upload */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Branding</h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Brand Name</Label>
                    <Input
                      value={config.name || ""}
                      onChange={(e) => updateConfig({ name: e.target.value })}
                      placeholder="Your Store Name"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Logo</Label>
                    {config.logoUrl ? (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                        <img
                          src={config.logoUrl}
                          alt="Brand logo"
                          className="h-10 max-w-[120px] object-contain"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{config.logoUrl.split("/").pop()}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={removeLogo}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => logoInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                          dragOver
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground hover:bg-muted/30"
                        }`}
                      >
                        {uploadingLogo ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground text-center">
                              <span className="font-medium text-foreground">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-[10px] text-muted-foreground">PNG, JPG or SVG · Max 5MB</p>
                          </>
                        )}
                      </div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoInputChange}
                    />
                  </div>
                </div>
              </div>

              {/* Typography & Shape */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <TypeIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Typography & Shape</h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Font Family</Label>
                    <Select value={config.fontFamily} onValueChange={(v) => updateConfig({ fontFamily: v })}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Border Radius: {config.borderRadius}px
                    </Label>
                    <Slider
                      value={[config.borderRadius]}
                      onValueChange={([v]) => updateConfig({ borderRadius: v })}
                      min={0}
                      max={24}
                      step={2}
                    />
                  </div>
                </div>
              </div>

              {/* Reset */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setConfig({ ...DEFAULT_BRAND_CONFIG }); setSavedConfigId(null); }}
              >
                Reset to Defaults
              </Button>
            </div>

            {/* Preview + Code */}
            <div className="space-y-6 min-w-0">
              {/* Live Preview */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Live Preview</span>
                </div>
                <div ref={previewRef} className="p-4">
                  {/* Mini customizer mockup */}
                  <div
                    className="rounded-lg overflow-hidden border shadow-lg"
                    style={{
                      borderColor: previewBorder,
                      borderRadius: `${config.borderRadius}px`,
                    }}
                  >
                    {/* Toolbar */}
                    <div
                      className="flex items-center justify-between px-3 py-2 border-b"
                      style={{
                        background: previewToolbar,
                        color: previewText,
                        borderColor: previewBorder,
                        fontFamily: config.fontFamily,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {config.logoUrl ? (
                          <img src={config.logoUrl} alt="Logo" className="h-5 max-w-[80px] object-contain" />
                        ) : (
                          <Sparkles className="h-4 w-4" style={{ color: config.primaryColor }} />
                        )}
                        <span className="text-xs font-semibold">
                          {config.name || "Product Name"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className="rounded px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: previewSidebarAccent, color: previewMuted }}
                        >
                          <Undo2 className="h-3 w-3 inline" />
                        </div>
                        <div
                          className="rounded px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: previewSidebarAccent, color: previewMuted }}
                        >
                          <Redo2 className="h-3 w-3 inline" />
                        </div>
                        <div
                          className="rounded px-2.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ background: config.primaryColor }}
                        >
                          ✓ Done
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex" style={{ minHeight: 200, height: "clamp(180px, 30vw, 240px)" }}>
                      {/* Sidebar */}
                      <div
                        className="w-20 border-r flex flex-col items-center pt-3 gap-3"
                        style={{
                          background: previewSidebar,
                          borderColor: previewBorder,
                          color: previewText,
                        }}
                      >
                        {[
                          { icon: TypeIcon, label: "Text" },
                          { icon: Square, label: "Shapes" },
                          { icon: Upload, label: "Upload" },
                        ].map(({ icon: Icon, label }) => (
                          <div
                            key={label}
                            className="flex flex-col items-center gap-0.5 text-[9px]"
                            style={{ color: label === "Text" ? config.primaryColor : previewMuted }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </div>
                        ))}
                      </div>
                      {/* Canvas */}
                      <div className="flex-1" style={{ background: previewBg }}>
                        <div className="h-full flex items-center justify-center">
                          <div
                            className="w-28 h-32 rounded border-2 border-dashed flex items-center justify-center text-xs"
                            style={{
                              borderColor: config.primaryColor + "60",
                              color: previewMuted,
                              borderRadius: `${Math.min(config.borderRadius, 16)}px`,
                            }}
                          >
                            Canvas
                          </div>
                        </div>
                      </div>
                      {/* Layers panel */}
                      <div
                        className="w-16 border-l flex flex-col items-center pt-3 gap-1"
                        style={{
                          background: previewSidebar,
                          borderColor: previewBorder,
                          color: previewText,
                        }}
                      >
                        <div className="flex items-center gap-1 text-[9px] mb-1" style={{ color: config.primaryColor }}>
                          <LayersIcon className="h-3 w-3" />
                          Layers
                        </div>
                        <div
                          className="w-12 h-4 rounded text-[7px] flex items-center px-1"
                          style={{ background: previewSidebarAccent, color: previewMuted }}
                        >
                          Text
                        </div>
                        <div
                          className="w-12 h-4 rounded text-[7px] flex items-center px-1"
                          style={{ background: previewSidebarAccent, color: previewMuted }}
                        >
                          Shape
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SDK Code Output */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">SDK Code</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCopyCode} className="gap-1.5 h-7 text-xs">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-foreground">
                  {generateSDKCode()}
                </pre>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
