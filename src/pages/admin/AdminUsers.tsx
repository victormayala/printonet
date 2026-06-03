import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Shield, ShieldOff, Pause, Play, Ban, CircleCheck, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  email: string;
  store_name: string | null;
  created_at: string;
  is_super_admin: boolean;
  store_count: number;
  is_banned: boolean;
};

const getErrorMessage = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_users");
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
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed"));
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
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed"));
    } finally {
      setBusy(null);
    }
  };

  const callUserAction = async (u: AdminUser, action: "ban" | "unban" | "delete") => {
    if (u.id === me?.id) {
      toast.error("You can't perform this action on your own account.");
      return;
    }
    setBusy(u.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", {
        body: { action, user_id: u.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const label =
        action === "ban" ? "Suspended" : action === "unban" ? "Reactivated" : "Deleted";
      toast.success(`${label} ${u.email}`);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      await qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Action failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          All platform accounts. <strong>Pause/Activate</strong> toggles the user's stores on or off. <strong>Suspend</strong> blocks the account from logging in. <strong>Delete</strong> permanently removes the account and all of their data.
        </p>
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
              <TableHead>Account</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
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
                  <TableCell>
                    {u.is_banned ? (
                      <Badge variant="destructive">suspended</Badge>
                    ) : (
                      <Badge variant="secondary">active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2 space-y-1">
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
                          <Pause className="h-3.5 w-3.5 mr-1" /> Pause stores
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => setStoresStatus(u, "active")}>
                          <Play className="h-3.5 w-3.5 mr-1" /> Activate stores
                        </Button>
                      </>
                    )}
                    {u.id !== me?.id && (
                      <>
                        {u.is_banned ? (
                          <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => callUserAction(u, "unban")}>
                            <CircleCheck className="h-3.5 w-3.5 mr-1" /> Unsuspend
                          </Button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" disabled={busy === u.id}>
                                <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Suspend {u.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Blocks this user from signing in and pauses all of their stores. You can unsuspend them later.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => callUserAction(u, "ban")}>
                                  Suspend account
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={busy === u.id}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {u.email}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Permanently deletes this user, their stores, products, integrations, and all related data. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => callUserAction(u, "delete")}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete forever
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
