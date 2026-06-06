import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Camera, User, Mail, Store, Copy, CheckCircle2, Fingerprint, CreditCard } from "lucide-react";
import Billing from "@/pages/Billing";

export default function ProfileSettings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "billing" ? "billing" : "profile";
  const [storeName, setStoreName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("store_name, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setStoreName(data.store_name || "");
          setAvatarUrl(data.avatar_url);
        }
        setLoading(false);
      });
  }, [user]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(newUrl);

    await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", user.id);
    setUploading(false);
    toast({ title: "Avatar updated" });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ store_name: storeName.trim() || null })
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
  };

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(user?.id ?? "");
    setCopied(true);
    toast({ title: "Copied!", description: "User ID copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  // Intentionally no full-page spinner early-return — that swap-out + swap-in
  // looks like the page "renders twice" on navigation. The form chrome
  // renders immediately and fields populate when the fetch resolves.
  void loading;

  const initials = storeName
    ? storeName.slice(0, 2).toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? "??");

  return (
    <div className="bg-background min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const next = new URLSearchParams(searchParams);
            if (v === "billing") next.set("tab", "billing");
            else next.delete("tab");
            setSearchParams(next, { replace: true });
          }}
          className="space-y-6"
        >

          <TabsContent value="profile" className="mt-0">
            <div className="max-w-2xl mx-auto">
              <Card className="overflow-hidden border-0 shadow-xl">
                {/* Gradient header banner */}
                <div className="relative h-40 bg-gradient-to-r from-primary via-primary to-accent">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(253,209,0,0.3),transparent_60%)]" />
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <div className="relative">
                      <Avatar className="h-24 w-24 text-lg ring-4 ring-background shadow-lg">
                        {avatarUrl ? <AvatarImage src={avatarUrl} alt="Avatar" /> : null}
                        <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <label className="absolute -bottom-1 -right-1 h-8 w-8 flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md cursor-pointer hover:scale-105 transition-transform">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleAvatarUpload(f);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-14 pb-6 text-center">
                  <h1 className="text-2xl font-bold text-foreground">
                    {storeName || "Your Profile"}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
                </div>

                <CardContent className="space-y-6 px-6 pb-8">
                  <div className="space-y-2">
                    <Label htmlFor="store-name" className="flex items-center gap-2 text-sm font-medium">
                      <Store className="h-4 w-4 text-accent" />
                      Store Name
                    </Label>
                    <Input
                      id="store-name"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="My Awesome Store"
                      className="bg-muted/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-4 w-4 text-accent" />
                      Email
                    </Label>
                    <Input value={user?.email ?? ""} disabled className="bg-muted/50 text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Fingerprint className="h-4 w-4 text-accent" />
                      User ID
                    </Label>
                    <div className="flex gap-2">
                      <Input value={user?.id ?? ""} disabled className="bg-muted/50 font-mono text-xs text-muted-foreground" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-accent/30 hover:bg-accent/10 hover:text-accent"
                        onClick={handleCopyUserId}
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Use this ID for store branding integrations.</p>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-0">
            <Billing />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
