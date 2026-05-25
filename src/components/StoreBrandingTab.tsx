import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { CorporateStore } from "@/types/corporateStore";
import { EditStoreDialog } from "@/pages/CorporateStores";

function ColorSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-md border shrink-0" style={{ background: value }} aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm">{value}</p>
      </div>
    </div>
  );
}

export function StoreBrandingTab({ store }: { store: CorporateStore }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Theme tokens applied to the storefront.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit branding
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ColorSwatch label="Primary color" value={store.primary_color} />
          </div>
          <Separator />
          <div className="flex items-center gap-2 text-sm">
            <Type className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{store.font_family}</span>
          </div>
          {(store.logo_url || store.secondary_logo_url || store.favicon_url) && (
            <>
              <Separator />
              <div className="grid grid-cols-3 gap-3">
                {store.logo_url && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Logo</p>
                    <div className="h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                      <img src={store.logo_url} alt="" className="h-full w-full object-contain" />
                    </div>
                  </div>
                )}
                {(store.secondary_logo_url || store.logo_url) && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Footer logo
                      {!store.secondary_logo_url && (
                        <span className="ml-1 text-muted-foreground/70">(uses main)</span>
                      )}
                    </p>
                    <div className="h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                      <img
                        src={store.secondary_logo_url ?? store.logo_url ?? ""}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                )}
                {store.favicon_url && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Favicon</p>
                    <div className="h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                      <img src={store.favicon_url} alt="" className="h-full w-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <EditStoreDialog
          store={store}
          onSaved={() => {
            setEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ["corporate_store", store.id, user?.id] });
            queryClient.invalidateQueries({ queryKey: ["corporate_stores", user?.id] });
          }}
        />
      </Dialog>
    </>
  );
}
