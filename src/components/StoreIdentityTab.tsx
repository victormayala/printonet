import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Globe, Loader2, Mail, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { CorporateStore } from "@/types/corporateStore";

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className={mono ? "font-mono text-sm" : "text-sm"} />
        <Button type="button" variant="outline" size="icon" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function StoreIdentityTab({ store }: { store: CorporateStore }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [domainDraft, setDomainDraft] = useState(store.custom_domain ?? "");
  const [savingDomain, setSavingDomain] = useState(false);

  const openEditDomain = () => {
    setDomainDraft(store.custom_domain ?? "");
    setEditOpen(true);
  };

  const saveDomain = async () => {
    const trimmed = domainDraft.trim().toLowerCase();
    if (trimmed && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) {
      toast({
        title: "Invalid domain",
        description: "Enter a domain like merch.yourbrand.com",
        variant: "destructive",
      });
      return;
    }
    setSavingDomain(true);
    try {
      const { error } = await supabase
        .from("corporate_stores")
        .update({ custom_domain: trimmed || null })
        .eq("id", store.id);
      if (error) throw error;
      toast({ title: "Custom domain updated" });
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["corporate_store", store.id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
    } catch (e) {
      toast({
        title: "Could not update domain",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingDomain(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Basic store information.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={openEditDomain}>
            <Pencil className="h-3.5 w-3.5" /> Edit domain
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{store.contact_email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            {store.custom_domain ? (
              <span className="truncate">{store.custom_domain}</span>
            ) : (
              <span className="text-muted-foreground italic">No custom domain</span>
            )}
          </div>
          {store.tenant_slug && <CopyField label="Tenant slug" value={store.tenant_slug} mono />}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit custom domain</DialogTitle>
            <DialogDescription>
              Point a domain you own at this store. Leave the field empty to remove.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-domain">Custom domain</Label>
              <Input
                id="custom-domain"
                value={domainDraft}
                onChange={(e) => setDomainDraft(e.target.value)}
                placeholder="merch.yourbrand.com"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingDomain}>
              Cancel
            </Button>
            <Button onClick={saveDomain} disabled={savingDomain}>
              {savingDomain && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
