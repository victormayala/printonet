import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Search, Download, Eye, Package, Calendar,
  Loader2, ExternalLink, Filter, Link2, Copy, Check, Printer,
} from "lucide-react";
import { format } from "date-fns";

type Session = {
  id: string;
  product_data: any;
  design_output: any;
  status: string;
  external_ref: string | null;
  customer_name: string | null;
  customer_email: string | null;
  order_notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function Orders() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    if (user) fetchSessions();
  }, [user]);

  async function fetchSessions() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customizer_sessions")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading orders", description: error.message, variant: "destructive" });
    } else {
      setSessions((data as Session[]) || []);
    }
    setLoading(false);
  }

  const filtered = sessions.filter((s) => {
    const productName = s.product_data?.name || "";
    const matchesSearch =
      productName.toLowerCase().includes(search.toLowerCase()) ||
      (s.external_ref || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.customer_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function getDesignImages(session: Session): string[] {
    if (!session.design_output) return [];
    const output = session.design_output;
    const images: string[] = [];
    if (typeof output === "object" && !Array.isArray(output)) {
      for (const key of Object.keys(output)) {
        if (typeof output[key] === "string" && output[key].startsWith("http")) {
          images.push(output[key]);
        }
      }
    }
    return images;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View completed customizer sessions and download print-ready designs.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product, reference, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No orders yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Orders will appear here when customers complete customizations on your products.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    {session.product_data?.name || "Untitled"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.customer_name || session.customer_email || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={session.status === "completed" ? "default" : "secondary"}
                    >
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {session.external_ref || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(session.created_at), "MMM d, yyyy")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSession(session)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Design Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSession?.product_data?.name || "Design Details"}
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant={selectedSession.status === "completed" ? "default" : "secondary"}>
                    {selectedSession.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {format(new Date(selectedSession.created_at), "MMM d, yyyy h:mm a")}
                </div>
                {selectedSession.customer_name && (
                  <div>
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    {selectedSession.customer_name}
                  </div>
                )}
                {selectedSession.customer_email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {selectedSession.customer_email}
                  </div>
                )}
                {selectedSession.external_ref && (
                  <div>
                    <span className="text-muted-foreground">Reference:</span>{" "}
                    <span className="font-mono text-xs">{selectedSession.external_ref}</span>
                  </div>
                )}
                {selectedSession.order_notes && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Notes:</span>{" "}
                    {selectedSession.order_notes}
                  </div>
                )}
              </div>

              {/* Design previews */}
              {(() => {
                const images = getDesignImages(selectedSession);
                if (images.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No design exports available for this session.
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Design Exports</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {images.map((url, i) => (
                        <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted">
                          <img src={url} alt={`Design view ${i + 1}`} className="w-full aspect-square object-contain" />
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Button size="sm" variant="secondary">
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
