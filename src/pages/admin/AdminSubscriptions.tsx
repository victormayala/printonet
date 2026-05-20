import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Sub = {
  id: string;
  user_id: string;
  price_id: string;
  status: string;
  environment: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  extra_store_quantity: number;
  created_at: string;
};

export default function AdminSubscriptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id,user_id,price_id,status,environment,current_period_end,cancel_at_period_end,extra_store_quantity,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Sub[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_users");
      if (error) throw error;
      return new Map((data || []).map((u: any) => [u.id, u.email as string]));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">All Printonet plan subscriptions.</p>
      </div>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Extra stores</TableHead>
              <TableHead>Renews</TableHead>
              <TableHead>Env</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : (data || []).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No subscriptions.</TableCell></TableRow>
            ) : (
              (data || []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">{(users?.get(s.user_id) as string | undefined) || s.user_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline">{s.price_id}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" || s.status === "trialing" ? "default" : "secondary"}>
                      {s.status}{s.cancel_at_period_end ? " (cancels)" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.extra_store_quantity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell><Badge variant="outline">{s.environment}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
