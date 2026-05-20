import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldOff, Pause, Play } from "lucide-react";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  email: string;
  store_name: string | null;
  created_at: string;
  is_super_admin: boolean;
  store_count: number;
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data || []) as AdminUser[];
    },
  });

  const filtered = (data || []).filter((u) => {
    const s = q.toLowerCase().trim();
    if (!s) return true;
    return (
      u.email?.toLowerCase().includes(s) ||
      u.store_name?.toLowerCase().includes(s) ||
      u.id.toLowerCase().includes(s)
    );
  });

  const toggleAdmin = async (u: AdminUser) => {
    if (u.id === me?.id && u.is_super_admin) {
      toast.error("You can't revoke your own super_admin role.");
      return;
    }
    setBusy(u.id);
    try {
      if (u.is_super_admin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", u.id)
          .eq("role", "super_admin");
        if (error) throw error;
        toast.success(`Revoked super_admin from ${u.email}`);
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: "super_admin" });
        if (error) throw error;
        toast.success(`Granted super_admin to ${u.email}`);
      }
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  const setStoresStatus = async (u: AdminUser, status: "active" | "paused") => {
    setBusy(u.id);
    try {
      const { error } = await supabase.rpc("printonet_set_user_stores_status", {
        p_user_id: u.id,
        p_status: status,
      });
      if (error) throw error;
      toast.success(`${status === "paused" ? "Paused" : "Reactivated"} stores for ${u.email}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">All platform accounts. Grant admin or pause their stores.</p>
      </div>
      <Input
        placeholder="Search by email, store name, or user id…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Store name</TableHead>
              <TableHead>Stores</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.store_name || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{u.store_count}</TableCell>
                  <TableCell>
                    {u.is_super_admin ? (
                      <Badge className="bg-accent text-accent-foreground">super_admin</Badge>
                    ) : (
                      <Badge variant="secondary">user</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === u.id}
                      onClick={() => toggleAdmin(u)}
                    >
                      {u.is_super_admin ? (
                        <><ShieldOff className="h-3.5 w-3.5 mr-1" /> Revoke</>
                      ) : (
                        <><Shield className="h-3.5 w-3.5 mr-1" /> Make admin</>
                      )}
                    </Button>
                    {u.store_count > 0 && (
                      <>
                        <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => setStoresStatus(u, "paused")}>
                          <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => setStoresStatus(u, "active")}>
                          <Play className="h-3.5 w-3.5 mr-1" /> Activate
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
