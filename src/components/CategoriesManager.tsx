import { useState, type DragEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, FolderTree, GripVertical } from "lucide-react";

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
type DragItem = Pick<CategoryRow, "id" | "parent_id">;
type DropIntent = { targetId: string; position: "before" | "after" } | null;

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
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["product_categories", user?.id] });

  const addCategory = async (name: string, parentId: string | null) => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const siblings = (rows ?? []).filter((r) => r.parent_id === parentId);
    const nextOrder = siblings.length
      ? Math.max(...siblings.map((s) => s.sort_order ?? 0)) + 1
      : 0;
    const { error } = await supabase.from("product_categories").insert({
      user_id: user.id, parent_id: parentId, name: trimmed, sort_order: nextOrder,
    });
    if (error) {
      toast({ title: "Could not create", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: parentId ? "Sub-category added" : "Category added" });
    refresh();
  };

  const reorderCategory = async (draggedId: string, targetId: string, position: "before" | "after") => {
    if (!user || draggedId === targetId) return;
    const currentRows = rows ?? [];
    const dragged = currentRows.find((r) => r.id === draggedId);
    const target = currentRows.find((r) => r.id === targetId);
    if (!dragged || !target) return;
    if ((dragged.parent_id ?? null) !== (target.parent_id ?? null)) {
      toast({ title: "Reorder within the same level", description: "Drag categories among categories, or sub-categories within the same parent.", variant: "destructive" });
      return;
    }

    const siblings = currentRows
      .filter((r) => (r.parent_id ?? null) === (target.parent_id ?? null))
      .slice()
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    const withoutDragged = siblings.filter((s) => s.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((s) => s.id === targetId);
    if (targetIndex < 0) return;

    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    const reordered = withoutDragged.slice();
    reordered.splice(insertIndex, 0, dragged);

    const updates = await Promise.all(
      reordered.map((s, i) =>
        supabase.from("product_categories").update({ sort_order: i }).eq("id", s.id).eq("user_id", user.id),
      ),
    );
    const failed = updates.find((u) => u.error);
    if (failed?.error) {
      toast({ title: "Reorder failed", description: failed.error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, node: CategoryNode) => {
    setDragItem({ id: node.id, parent_id: node.parent_id });
    setDropIntent(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.id);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, node: CategoryNode) => {
    const activeDrag = dragItem ?? rows?.find((r) => r.id === event.dataTransfer.getData("text/plain"));
    if (!activeDrag || activeDrag.id === node.id) return;
    event.preventDefault();
    if ((activeDrag.parent_id ?? null) !== (node.parent_id ?? null)) {
      event.dataTransfer.dropEffect = "none";
      setDropIntent(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    event.dataTransfer.dropEffect = "move";
    setDropIntent({ targetId: node.id, position });
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>, node: CategoryNode) => {
    event.preventDefault();
    const draggedId = dragItem?.id || event.dataTransfer.getData("text/plain");
    const position = dropIntent?.targetId === node.id ? dropIntent.position : "after";
    setDragItem(null);
    setDropIntent(null);
    await reorderCategory(draggedId, node.id, position);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDropIntent(null);
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
                dragItem={dragItem}
                dropIntent={dropIntent}
                onToggle={toggle}
                onAddChild={addCategory}
                onRename={renameCategory}
                onAskDelete={setConfirmDelete}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
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
  node, level, expanded, dragItem, dropIntent, onToggle, onAddChild, onRename, onAskDelete, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  node: CategoryNode;
  level: number;
  expanded: Set<string>;
  dragItem: DragItem | null;
  dropIntent: DropIntent;
  onToggle: (id: string) => void;
  onAddChild: (name: string, parentId: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onAskDelete: (n: CategoryNode) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, node: CategoryNode) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, node: CategoryNode) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, node: CategoryNode) => Promise<void>;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const [adding, setAdding] = useState(false);
  const [childName, setChildName] = useState("");
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isDragging = dragItem?.id === node.id;
  const dropPosition = dropIntent?.targetId === node.id ? dropIntent.position : null;

  return (
    <li>
      <div
        draggable={!editing && !adding}
        onDragStart={(event) => onDragStart(event, node)}
        onDragOver={(event) => onDragOver(event, node)}
        onDrop={(event) => onDrop(event, node)}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-2 rounded-md hover:bg-muted/50 px-2 py-1.5 group border-y transition-colors ${
          isDragging ? "opacity-50 bg-muted/60" : ""
        } ${dropPosition === "before" ? "border-t-primary border-b-transparent" : dropPosition === "after" ? "border-b-primary border-t-transparent" : "border-transparent"}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true" />
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
              dragItem={dragItem}
              dropIntent={dropIntent}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onRename={onRename}
              onAskDelete={onAskDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
