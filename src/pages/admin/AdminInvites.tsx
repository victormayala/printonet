import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Copy, Trash2, Plus, Mail } from "lucide-react";
import { toast } from "sonner";

type Invite = {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  note: string | null;
};

function inviteLink(token: string) {
  return `${window.location.origin}/auth?invite=${token}`;
}

export default function AdminInvites() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings" as any)
        .select("invite_only_enabled")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data as { invite_only_enabled: boolean } | null;
    },
  });

  const { data: invites, isLoading } = useQuery({
    queryKey: ["invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Invite[];
    },
  });

  const toggle = async (enabled: boolean) => {
    const { error } = await supabase.rpc("admin_set_invite_only" as any, { p_enabled: enabled });
    if (error) return toast.error(error.message);
    toast.success(enabled ? "Invite-only enabled" : "Invite-only disabled — open signups");
    qc.invalidateQueries({ queryKey: ["platform-settings"] });
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_invite" as any, {
        p_email: email.trim(),
        p_note: note.trim() || null,
        p_expires_in_days: 30,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.token) {
        await navigator.clipboard.writeText(inviteLink(row.token)).catch(() => {});
        toast.success("Invite created — link copied to clipboard");
      }
      setEmail("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["invites"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("invites" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite removed");
    qc.invalidateQueries({ queryKey: ["invites"] });
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(inviteLink(token));
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invites & access</h1>
        <p className="text-sm text-muted-foreground">Control who can sign up to the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite-only signups</CardTitle>
          <CardDescription>When enabled, new accounts require a valid invite link tied to their email.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={settings?.invite_only_enabled ? "default" : "secondary"}>
              {settings?.invite_only_enabled ? "Invite-only" : "Open signups"}
            </Badge>
          </div>
          <Switch
            checked={!!settings?.invite_only_enabled}
            onCheckedChange={toggle}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create an invite</CardTitle>
          <CardDescription>Generates a unique link the recipient must use to sign up with the email below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInvite} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-note">Note (optional)</Label>
              <Input id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Acme team lead" />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : !invites?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No invites yet.</TableCell></TableRow>
            ) : (
              invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                const status = i.used_at ? "used" : expired ? "expired" : "active";
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{i.email}</TableCell>
                    <TableCell>
                      <Badge variant={status === "active" ? "default" : "secondary"} className={status === "used" ? "bg-muted text-muted-foreground" : status === "expired" ? "bg-destructive/15 text-destructive" : ""}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(i.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.note || "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {!i.used_at && (
                        <Button size="sm" variant="outline" onClick={() => copy(i.token)}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => remove(i.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
