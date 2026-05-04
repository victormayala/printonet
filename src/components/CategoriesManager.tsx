import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, FolderTree, ArrowUp, ArrowDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type CategoryRow = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
};

export type CategoryNode = CategoryRow & { children: CategoryNode[] };

export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: CategoryNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["product_categories", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id,user_id,parent_id,name,sort_order")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}

export default function CategoriesManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rows, isLoading } = useCategories();
  const tree = buildCategoryTree(rows ?? []);

  const [newRoot, setNewRoot] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<CategoryNode | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["product_categories", user?.id] });

  const addCategory = async (name: string, parentId: string | null) => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("product_categories").insert({
      user_id: user.id, parent_id: parentId, name: trimmed,
    });
    if (error) {
      toast({ title: "Could not create", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: parentId ? "Sub-category added" : "Category added" });
    refresh();
  };

  const renameCategory = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("product_categories").update({ name: trimmed }).eq("id", id);
    if (error) {
      toast({ title: "Rename failed", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const deleteCategory = async (node: CategoryNode) => {
    const { error } = await supabase.from("product_categories").delete().eq("id", node.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    setConfirmDelete(null);
    refresh();
  };

  const handleCreateRoot = async () => {
    setCreating(true);
    await addCategory(newRoot, null);
    setNewRoot("");
    setCreating(false);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Organize products with categories and sub-categories. These are sent to your corporate stores.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            placeholder="New category name (e.g. Apparel)"
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoot(); }}
          />
          <Button onClick={handleCreateRoot} disabled={creating || !newRoot.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
          </div>
        ) : tree.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12 border rounded-md border-dashed">
            No categories yet. Create your first one above.
          </div>
        ) : (
          <ul className="space-y-1">
            {tree.map((node) => (
              <CategoryNodeItem
                key={node.id}
                node={node}
                level={0}
                expanded={expanded}
                onToggle={toggle}
                onAddChild={addCategory}
                onRename={renameCategory}
                onAskDelete={setConfirmDelete}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.children.length
                ? "This will also delete all sub-categories. Products keep their assignment field but lose the link."
                : "Products keep their assignment field but lose the link."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteCategory(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CategoryNodeItem({
  node, level, expanded, onToggle, onAddChild, onRename, onAskDelete,
}: {
  node: CategoryNode;
  level: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (name: string, parentId: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onAskDelete: (n: CategoryNode) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const [adding, setAdding] = useState(false);
  const [childName, setChildName] = useState("");
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className="flex items-center gap-2 rounded-md hover:bg-muted/50 px-2 py-1.5 group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="text-muted-foreground"
          aria-label="Toggle"
        >
          {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
        </button>

        {editing ? (
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={async () => { await onRename(node.id, editValue); setEditing(false); }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") { await onRename(node.id, editValue); setEditing(false); }
              if (e.key === "Escape") { setEditValue(node.name); setEditing(false); }
            }}
            className="h-7 text-sm flex-1"
          />
        ) : (
          <span className="flex-1 text-sm">{node.name}</span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {level === 0 && (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAdding((v) => !v); if (!isOpen) onToggle(node.id); }}>
              <Plus className="h-3.5 w-3.5" /> Sub
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onAskDelete(node)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {adding && (
        <div className="flex gap-2 my-1" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
          <Input
            autoFocus
            placeholder="Sub-category name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && childName.trim()) {
                await onAddChild(childName, node.id); setChildName(""); setAdding(false);
              }
              if (e.key === "Escape") { setChildName(""); setAdding(false); }
            }}
            className="h-8"
          />
          <Button
            size="sm"
            onClick={async () => {
              if (!childName.trim()) return;
              await onAddChild(childName, node.id); setChildName(""); setAdding(false);
            }}
          >
            Add
          </Button>
        </div>
      )}

      {hasChildren && isOpen && (
        <ul>
          {node.children.map((child) => (
            <CategoryNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onRename={onRename}
              onAskDelete={onAskDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
