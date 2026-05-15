import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sun, Moon, Paintbrush, Type as TypeIcon, Palette, Image as ImageIcon,
  Square, Upload, Save, X, Loader2, Eye, Sparkles, Undo2, Redo2,
  Layers as LayersIcon, RefreshCw,
} from "lucide-react";
import { DEFAULT_BRAND_CONFIG, type BrandConfig, brandConfigToCSSVars } from "@/lib/brand-config";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const FONT_OPTIONS = [
  "Inter","Space Grotesk","Roboto","Open Sans","Lato","Montserrat","Poppins","Nunito",
  "Raleway","Source Sans 3","DM Sans","IBM Plex Sans","Work Sans","Outfit","Plus Jakarta Sans",
];

interface Props {
  store: CorporateStore & {
    customizer_theme?: string;
    customizer_border_radius?: number;
    customizer_logo_dark_url?: string | null;
  };
}

export function StoreBrandSettings({ store }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const darkLogoInputRef = useRef<HTMLInputElement>(null);

  const initial: BrandConfig = {
    name: store.name || "",
    logoUrl: store.logo_url || "",
    logoDarkUrl: (store as any).customizer_logo_dark_url || "",
    theme: ((store as any).customizer_theme === "light" ? "light" : "dark") as BrandConfig["theme"],
    primaryColor: store.primary_color || DEFAULT_BRAND_CONFIG.primaryColor,
    accentColor: store.accent_color || DEFAULT_BRAND_CONFIG.accentColor,
    fontFamily: store.font_family || DEFAULT_BRAND_CONFIG.fontFamily,
    borderRadius: (store as any).customizer_border_radius ?? DEFAULT_BRAND_CONFIG.borderRadius,
  };

  const [config, setConfig] = useState<BrandConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState<"light" | "dark" | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [darkDragOver, setDarkDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!previewRef.current) return;
    const vars = brandConfigToCSSVars(config);
    Object.entries(vars).forEach(([k, v]) => previewRef.current!.style.setProperty(k, v));
  }, [config]);

  function update(p: Partial<BrandConfig>) { setConfig((prev) => ({ ...prev, ...p })); }

  const handleLogoUpload = useCallback(async (file: File, variant: "light" | "dark" = "light") => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image (PNG, JPG, SVG)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB", variant: "destructive" });
      return;
    }
    setUploadingLogo(variant);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user?.id}/stores/${store.id}/logo_${variant}_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from("brand-assets").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(data.path);
      if (variant === "dark") update({ logoDarkUrl: urlData.publicUrl });
      else update({ logoUrl: urlData.publicUrl });
      toast({ title: variant === "dark" ? "Dark-mode logo uploaded" : "Logo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(null);
    }
  }, [toast, user?.id, store.id]);

  async function importFromGlobal() {
    if (!user) return;
    setImporting(true);
    try {
      const { data, error } = await supabase
        .from("brand_configs").select("*").eq("user_id", user.id)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({ title: "No global brand found", description: "Set up your account branding first to import from it." });
        return;
      }
      setConfig({
        name: data.name || config.name,
        logoUrl: data.logo_url || "",
        logoDarkUrl: (data as any).logo_dark_url || "",
        theme: (data.theme === "light" ? "light" : "dark"),
        primaryColor: data.primary_color,
        accentColor: data.accent_color,
        fontFamily: data.font_family,
        borderRadius: data.border_radius,
      });
      toast({ title: "Imported from global brand", description: "Click Save to apply to this store." });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("corporate_stores")
        .update({
          logo_url: config.logoUrl || null,
          customizer_logo_dark_url: config.logoDarkUrl || null,
          primary_color: config.primaryColor,
          accent_color: config.accentColor,
          font_family: config.fontFamily,
          customizer_theme: config.theme,
          customizer_border_radius: config.borderRadius,
        } as any)
        .eq("id", store.id);
      if (error) throw error;
      toast({ title: "Customizer brand updated" });
      queryClient.invalidateQueries({ queryKey: ["corporate_store", store.id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setConfig({ ...DEFAULT_BRAND_CONFIG, name: store.name || "" });
  }

  // Preview tokens
  const previewBg = config.theme === "dark" ? "hsl(240 10% 12%)" : "hsl(0 0% 95%)";
  const previewToolbar = config.theme === "dark" ? "hsl(240 10% 10%)" : "hsl(0 0% 98%)";
  const previewSidebar = config.theme === "dark" ? "hsl(240 10% 8%)" : "hsl(0 0% 98%)";
  const previewText = config.theme === "dark" ? "hsl(240 5% 85%)" : "hsl(240 10% 10%)";
  const previewMuted = config.theme === "dark" ? "hsl(240 4% 55%)" : "hsl(240 4% 46%)";
  const previewBorder = config.theme === "dark" ? "hsl(240 8% 18%)" : "hsl(0 0% 88%)";
  const previewSidebarAccent = config.theme === "dark" ? "hsl(240 8% 14%)" : "hsl(0 0% 94%)";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Customizer brand for {store.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            These settings only apply to this store's customizer. Use "Import from global brand" to copy your account-wide branding.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={importFromGlobal} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Import from global brand
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-6">
        {/* Settings */}
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /><h4 className="font-semibold text-sm">Theme</h4></div>
            <div className="flex gap-2">
              <button onClick={() => update({ theme: "dark" })}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${config.theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"}`}>
                <Moon className="h-4 w-4" /> Dark
              </button>
              <button onClick={() => update({ theme: "light" })}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${config.theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"}`}>
                <Sun className="h-4 w-4" /> Light
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2"><Paintbrush className="h-4 w-4 text-primary" /><h4 className="font-semibold text-sm">Colors</h4></div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={config.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} className="h-9 w-9 rounded-lg cursor-pointer border-0" />
                  <Input value={config.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} className="font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={config.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="h-9 w-9 rounded-lg cursor-pointer border-0" />
                  <Input value={config.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="font-mono text-xs" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /><h4 className="font-semibold text-sm">Logo</h4></div>
            {config.logoUrl ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <img src={config.logoUrl} alt="Brand logo" className="h-10 max-w-[120px] object-contain" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{config.logoUrl.split("/").pop()}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => update({ logoUrl: "" })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleLogoUpload(f); }}
                onClick={() => logoInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground hover:bg-muted/30"}`}
              >
                {uploadingLogo ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center"><span className="font-medium text-foreground">Click to upload</span> or drag and drop</p>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG or SVG · Max 5MB</p>
                  </>
                )}
              </div>
            )}
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
          </div>

          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2"><TypeIcon className="h-4 w-4 text-primary" /><h4 className="font-semibold text-sm">Typography & Shape</h4></div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Font Family</Label>
                <Select value={config.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Border Radius: {config.borderRadius}px</Label>
                <Slider value={[config.borderRadius]} onValueChange={([v]) => update({ borderRadius: v })} min={0} max={24} step={2} />
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={resetToDefaults}>Reset to Defaults</Button>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Live Preview</span>
            </div>
            <div ref={previewRef} className="p-4">
              <div className="rounded-lg overflow-hidden border shadow-lg" style={{ borderColor: previewBorder, borderRadius: `${config.borderRadius}px` }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ background: previewToolbar, color: previewText, borderColor: previewBorder, fontFamily: config.fontFamily }}>
                  <div className="flex items-center gap-2">
                    {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-5 max-w-[80px] object-contain" /> : <Sparkles className="h-4 w-4" style={{ color: config.primaryColor }} />}
                    <span className="text-xs font-semibold">{config.name || store.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="rounded px-2 py-0.5 text-[10px]" style={{ background: previewSidebarAccent, color: previewMuted }}><Undo2 className="h-3 w-3 inline" /></div>
                    <div className="rounded px-2 py-0.5 text-[10px]" style={{ background: previewSidebarAccent, color: previewMuted }}><Redo2 className="h-3 w-3 inline" /></div>
                    <div className="rounded px-2.5 py-0.5 text-[10px] font-medium text-white" style={{ background: config.primaryColor }}>✓ Done</div>
                  </div>
                </div>
                <div className="flex" style={{ minHeight: 200, height: "clamp(180px, 30vw, 240px)" }}>
                  <div className="w-20 border-r flex flex-col items-center pt-3 gap-3" style={{ background: previewSidebar, borderColor: previewBorder, color: previewText }}>
                    {[{ icon: TypeIcon, label: "Text" },{ icon: Square, label: "Shapes" },{ icon: Upload, label: "Upload" }].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-0.5 text-[9px]" style={{ color: label === "Text" ? config.primaryColor : previewMuted }}>
                        <Icon className="h-3.5 w-3.5" />{label}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1" style={{ background: previewBg }}>
                    <div className="h-full flex items-center justify-center">
                      <div className="w-28 h-32 rounded border-2 border-dashed flex items-center justify-center text-xs" style={{ borderColor: config.primaryColor + "60", color: previewMuted, borderRadius: `${Math.min(config.borderRadius, 16)}px` }}>Canvas</div>
                    </div>
                  </div>
                  <div className="w-16 border-l flex flex-col items-center pt-3 gap-1" style={{ background: previewSidebar, borderColor: previewBorder, color: previewText }}>
                    <div className="flex items-center gap-1 text-[9px] mb-1" style={{ color: config.primaryColor }}><LayersIcon className="h-3 w-3" />Layers</div>
                    <div className="w-12 h-4 rounded text-[7px] flex items-center px-1" style={{ background: previewSidebarAccent, color: previewMuted }}>Text</div>
                    <div className="w-12 h-4 rounded text-[7px] flex items-center px-1" style={{ background: previewSidebarAccent, color: previewMuted }}>Shape</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
