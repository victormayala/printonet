import { useMemo, useState, type DragEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, FolderTree,
  GripVertical, Link2, X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  kind: "category" | "subcategory";
};

export type CategoryLink = {
  id: string;
  user_id: string;
  category_id: string;
  subcategory_id: string;
  sort_order: number;
};

// Backwards-compatible tree node used by Products.tsx
export type CategoryNode = CategoryRow & {
  parent_id: string | null;
  children: CategoryNode[];
};

export function buildCategoryTree(
  rows: CategoryRow[],
  links: CategoryLink[] = [],
): CategoryNode[] {
  const byId = new Map<string, CategoryRow>();
  rows.forEach((r) => byId.set(r.id, r));

  const categories = rows
    .filter((r) => r.kind === "category")
    .slice()
    .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));

  return categories.map((cat) => {
    const childLinks = links
      .filter((l) => l.category_id === cat.id)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const children: CategoryNode[] = childLinks
      .map((l) => byId.get(l.subcategory_id))
      .filter((s): s is CategoryRow => !!s)
      .map((s) => ({ ...s, parent_id: cat.id, children: [] }));
    return { ...cat, parent_id: null, children };
  });
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["product_categories", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id,user_id,name,sort_order,kind")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}

export function useCategoryLinks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["product_category_links", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CategoryLink[]> => {
      const { data, error } = await supabase
        .from("product_category_links")
        .select("id,user_id,category_id,subcategory_id,sort_order")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as CategoryLink[];
    },
  });
}

type DropIntent = { categoryId: string; targetSubId: string; position: "before" | "after" } | null;
type DeleteIntent =
  | { type: "category"; row: CategoryRow }
  | { type: "subcategory"; row: CategoryRow; categoryId: string; linkCount: number }
  | null;

export default function CategoriesManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rows, isLoading: rowsLoading } = useCategories();
  const { data: links, isLoading: linksLoading } = useCategoryLinks();

  const [newRoot, setNewRoot] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<DeleteIntent>(null);
  const [deleteMode, setDeleteMode] = useState<"unlink" | "purge">("unlink");
  const [dragSubId, setDragSubId] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent>(null);
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [catDropIntent, setCatDropIntent] = useState<{ targetId: string; position: "before" | "after" } | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product_categories", user?.id] });
    qc.invalidateQueries({ queryKey: ["product_category_links", user?.id] });
  };

  const allCategories = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.kind === "category")
        .slice()
        .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name)),
    [rows],
  );
  const allSubcategories = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.kind === "subcategory")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );

  const linksByCategory = useMemo(() => {
    const map = new Map<string, CategoryLink[]>();
    (links ?? []).forEach((l) => {
      const arr = map.get(l.category_id) ?? [];
      arr.push(l);
      map.set(l.category_id, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => a.sort_order - b.sort_order));
    return map;
  }, [links]);

  const linksBySub = useMemo(() => {
    const map = new Map<string, CategoryLink[]>();
    (links ?? []).forEach((l) => {
      const arr = map.get(l.subcategory_id) ?? [];
      arr.push(l);
      map.set(l.subcategory_id, arr);
    });
    return map;
  }, [links]);

  /* ---------- Categories ---------- */
  const addRootCategory = async () => {
    if (!user) return;
    const name = newRoot.trim();
    if (!name) return;
    setCreating(true);
    const nextOrder = allCategories.length
      ? Math.max(...allCategories.map((c) => c.sort_order ?? 0)) + 1
      : 0;
    const { error } = await supabase
      .from("product_categories")
      .insert({ user_id: user.id, name, sort_order: nextOrder, kind: "category" });
    setCreating(false);
    if (error) {
      toast({ title: "Could not create", description: error.message, variant: "destructive" });
      return;
    }
    setNewRoot("");
    toast({ title: "Category added" });
    refresh();
  };

  const renameRow = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("product_categories").update({ name: trimmed }).eq("id", id);
    if (error) {
      toast({ title: "Rename failed", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const deleteCategoryRow = async (id: string) => {
    const { error } = await supabase.from("product_categories").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    refresh();
  };

  /* ---------- Subcategories ---------- */
  const createSubcategory = async (name: string): Promise<string | null> => {
    if (!user) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ user_id: user.id, name: trimmed, sort_order: 0, kind: "subcategory" })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Could not create sub-category", description: error.message, variant: "destructive" });
      return null;
    }
    return data.id;
  };

  const linkSubToCategory = async (subId: string, categoryId: string) => {
    if (!user) return;
    const existing = linksByCategory.get(categoryId) ?? [];
    if (existing.some((l) => l.subcategory_id === subId)) return;
    const nextOrder = existing.length ? Math.max(...existing.map((l) => l.sort_order)) + 1 : 0;
    const { error } = await supabase.from("product_category_links").insert({
      user_id: user.id, category_id: categoryId, subcategory_id: subId, sort_order: nextOrder,
    });
    if (error) {
      toast({ title: "Link failed", description: error.message, variant: "destructive" });
    }
  };

  const unlinkSubFromCategory = async (subId: string, categoryId: string) => {
    const { error } = await supabase
      .from("product_category_links")
      .delete()
      .eq("category_id", categoryId)
      .eq("subcategory_id", subId);
    if (error) {
      toast({ title: "Unlink failed", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const handleAddNewSub = async (name: string, categoryId: string) => {
    const id = await createSubcategory(name);
    if (!id) return;
    await linkSubToCategory(id, categoryId);
    refresh();
  };

  const handleAttachExisting = async (subIds: string[], categoryId: string) => {
    for (const subId of subIds) {
      // eslint-disable-next-line no-await-in-loop
      await linkSubToCategory(subId, categoryId);
    }
    refresh();
  };

  /* ---------- Reorder categories (root) ---------- */
  const reorderCategories = async (draggedId: string, targetId: string, position: "before" | "after") => {
    if (!user || draggedId === targetId) return;
    const sequence = allCategories.slice();
    const dragged = sequence.find((c) => c.id === draggedId);
    if (!dragged) return;
    const without = sequence.filter((c) => c.id !== draggedId);
    const targetIdx = without.findIndex((c) => c.id === targetId);
    if (targetIdx < 0) return;
    const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
    without.splice(insertIdx, 0, dragged);
    const updates = await Promise.all(
      without.map((c, i) =>
        supabase.from("product_categories").update({ sort_order: i }).eq("id", c.id).eq("user_id", user.id),
      ),
    );
    const failed = updates.find((u) => u.error);
    if (failed?.error) {
      toast({ title: "Reorder failed", description: failed.error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  /* ---------- Reorder subcategories within a category (via links) ---------- */
  const reorderLinks = async (categoryId: string, draggedSubId: string, targetSubId: string, position: "before" | "after") => {
    if (!user || draggedSubId === targetSubId) return;
    const siblings = (linksByCategory.get(categoryId) ?? []).slice();
    const dragged = siblings.find((l) => l.subcategory_id === draggedSubId);
    if (!dragged) return;
    const without = siblings.filter((l) => l.subcategory_id !== draggedSubId);
    const targetIdx = without.findIndex((l) => l.subcategory_id === targetSubId);
    if (targetIdx < 0) return;
    const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
    without.splice(insertIdx, 0, dragged);
    const updates = await Promise.all(
      without.map((l, i) =>
        supabase.from("product_category_links").update({ sort_order: i }).eq("id", l.id).eq("user_id", user.id),
      ),
    );
    const failed = updates.find((u) => u.error);
    if (failed?.error) {
      toast({ title: "Reorder failed", description: failed.error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  /* ---------- UI helpers ---------- */
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const onCategoryDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggingCatId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-cat", id);
  };
  const onCategoryDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    if (!draggingCatId || draggingCatId === id) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setCatDropIntent({ targetId: id, position });
  };
  const onCategoryDrop = async (e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    if (!draggingCatId) return;
    const intent = catDropIntent?.targetId === id ? catDropIntent.position : "after";
    const dragged = draggingCatId;
    setDraggingCatId(null);
    setCatDropIntent(null);
    await reorderCategories(dragged, id, intent);
  };

  const onSubDragStart = (e: DragEvent<HTMLDivElement>, subId: string) => {
    setDragSubId(subId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-sub", subId);
  };
  const onSubDragOver = (e: DragEvent<HTMLDivElement>, categoryId: string, subId: string) => {
    if (!dragSubId || dragSubId === subId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropIntent({ categoryId, targetSubId: subId, position });
  };
  const onSubDrop = async (e: DragEvent<HTMLDivElement>, categoryId: string, subId: string) => {
    e.preventDefault();
    if (!dragSubId) return;
    const intent = dropIntent && dropIntent.categoryId === categoryId && dropIntent.targetSubId === subId
      ? dropIntent.position
      : "after";
    const dragged = dragSubId;
    setDragSubId(null);
    setDropIntent(null);
    await reorderLinks(categoryId, dragged, subId, intent);
  };

  /* ---------- Delete confirmation handling ---------- */
  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "category") {
      await deleteCategoryRow(confirmDelete.row.id);
    } else {
      const { row, categoryId } = confirmDelete;
      if (deleteMode === "purge") {
        await deleteCategoryRow(row.id); // cascades all links
      } else {
        await unlinkSubFromCategory(row.id, categoryId);
      }
    }
    setConfirmDelete(null);
    setDeleteMode("unlink");
  };

  const isLoading = rowsLoading || linksLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Organize products with categories and reusable sub-categories. Sub-categories can belong to multiple categories.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* New category */}
        <div className="flex gap-2">
          <Input
            placeholder="New category name (e.g. Apparel)"
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addRootCategory(); }}
          />
          <Button onClick={addRootCategory} disabled={creating || !newRoot.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
          </div>
        ) : allCategories.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12 border rounded-md border-dashed">
            No categories yet. Create your first one above.
          </div>
        ) : (
          <ul className="space-y-1">
            {allCategories.map((cat) => {
              const isOpen = expanded.has(cat.id);
              const subLinks = linksByCategory.get(cat.id) ?? [];
              const subRows = subLinks
                .map((l) => allSubcategories.find((s) => s.id === l.subcategory_id))
                .filter((s): s is CategoryRow => !!s);
              const isDragging = draggingCatId === cat.id;
              const dropPos = catDropIntent?.targetId === cat.id ? catDropIntent.position : null;
              return (
                <li key={cat.id}>
                  <CategoryRowView
                    cat={cat}
                    hasChildren={subRows.length > 0}
                    isOpen={isOpen}
                    isDragging={isDragging}
                    dropPos={dropPos}
                    onToggle={() => toggle(cat.id)}
                    onRename={(name) => renameRow(cat.id, name)}
                    onAskDelete={() => setConfirmDelete({ type: "category", row: cat })}
                    onDragStart={(e) => onCategoryDragStart(e, cat.id)}
                    onDragOver={(e) => onCategoryDragOver(e, cat.id)}
                    onDrop={(e) => onCategoryDrop(e, cat.id)}
                    onDragEnd={() => { setDraggingCatId(null); setCatDropIntent(null); }}
                    availableSubs={allSubcategories.filter((s) => !subLinks.some((l) => l.subcategory_id === s.id))}
                    onAttachExisting={(ids) => handleAttachExisting(ids, cat.id)}
                    onAddNewSub={(name) => handleAddNewSub(name, cat.id)}
                  />

                  {isOpen && subRows.length > 0 && (
                    <ul className="ml-6 mt-1 space-y-1">
                      {subRows.map((sub) => {
                        const dragging = dragSubId === sub.id;
                        const pos = dropIntent && dropIntent.categoryId === cat.id && dropIntent.targetSubId === sub.id
                          ? dropIntent.position
                          : null;
                        const reuseCount = linksBySub.get(sub.id)?.length ?? 1;
                        return (
                          <li key={`${cat.id}-${sub.id}`}>
                            <SubRowView
                              sub={sub}
                              reuseCount={reuseCount}
                              isDragging={dragging}
                              dropPos={pos}
                              onRename={(name) => renameRow(sub.id, name)}
                              onAskDelete={() => {
                                setDeleteMode(reuseCount > 1 ? "unlink" : "purge");
                                setConfirmDelete({ type: "subcategory", row: sub, categoryId: cat.id, linkCount: reuseCount });
                              }}
                              onDragStart={(e) => onSubDragStart(e, sub.id)}
                              onDragOver={(e) => onSubDragOver(e, cat.id, sub.id)}
                              onDrop={(e) => onSubDrop(e, cat.id, sub.id)}
                              onDragEnd={() => { setDragSubId(null); setDropIntent(null); }}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Subcategory pool */}
        {allSubcategories.length > 0 && (
          <div className="border-t pt-6 space-y-3">
            <div>
              <h3 className="text-sm font-medium">All sub-categories</h3>
              <p className="text-xs text-muted-foreground">
                Reusable sub-categories. The badge shows how many categories each one is linked to.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allSubcategories.map((sub) => {
                const count = linksBySub.get(sub.id)?.length ?? 0;
                return (
                  <span key={sub.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-muted/30">
                    {sub.name}
                    <span className="text-muted-foreground">({count})</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) { setConfirmDelete(null); setDeleteMode("unlink"); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.type === "category"
                ? `Delete "${confirmDelete.row.name}"?`
                : `Remove "${confirmDelete?.row.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.type === "category"
                ? "All links to its sub-categories will be removed. The sub-categories themselves are kept (they may belong to other categories)."
                : confirmDelete?.linkCount && confirmDelete.linkCount > 1
                  ? "This sub-category is used by multiple categories. Choose how to remove it:"
                  : "This sub-category isn't linked anywhere else. Choose what to do:"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmDelete?.type === "subcategory" && (
            <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as "unlink" | "purge")} className="space-y-2 py-2">
              <div className="flex items-start gap-2">
                <RadioGroupItem value="unlink" id="del-unlink" className="mt-1" />
                <Label htmlFor="del-unlink" className="font-normal cursor-pointer">
                  Remove from this category only
                  <p className="text-xs text-muted-foreground">Keeps the sub-category available elsewhere.</p>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="purge" id="del-purge" className="mt-1" />
                <Label htmlFor="del-purge" className="font-normal cursor-pointer">
                  Delete sub-category entirely
                  <p className="text-xs text-muted-foreground">Removes it from every category it's linked to.</p>
                </Label>
              </div>
            </RadioGroup>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAction}>
              {confirmDelete?.type === "subcategory" && deleteMode === "unlink" ? "Remove link" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ---------------- Row sub-components ---------------- */

function CategoryRowView({
  cat, hasChildren, isOpen, isDragging, dropPos, onToggle, onRename, onAskDelete,
  onDragStart, onDragOver, onDrop, onDragEnd,
  availableSubs, onAttachExisting, onAddNewSub,
}: {
  cat: CategoryRow;
  hasChildren: boolean;
  isOpen: boolean;
  isDragging: boolean;
  dropPos: "before" | "after" | null;
  onToggle: () => void;
  onRename: (name: string) => Promise<void>;
  onAskDelete: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  availableSubs: CategoryRow[];
  onAttachExisting: (ids: string[]) => Promise<void>;
  onAddNewSub: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(cat.name);
  const [adding, setAdding] = useState(false);
  const [childName, setChildName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  return (
    <>
      <div
        draggable={!editing && !adding}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-2 rounded-md hover:bg-muted/50 px-2 py-1.5 group border-y transition-colors ${
          isDragging ? "opacity-50 bg-muted/60" : ""
        } ${dropPos === "before" ? "border-t-primary border-b-transparent" : dropPos === "after" ? "border-b-primary border-t-transparent" : "border-transparent"}`}
      >
        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true" />
        <button type="button" onClick={onToggle} className="text-muted-foreground" aria-label="Toggle">
          {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
        </button>

        {editing ? (
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={async () => { await onRename(editValue); setEditing(false); }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") { await onRename(editValue); setEditing(false); }
              if (e.key === "Escape") { setEditValue(cat.name); setEditing(false); }
            }}
            className="h-7 text-sm flex-1"
          />
        ) : (
          <span className="flex-1 text-sm font-medium">{cat.name}</span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setPicked(new Set()); }}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7" disabled={availableSubs.length === 0}>
                <Link2 className="h-3.5 w-3.5" /> Link
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <p className="text-xs text-muted-foreground px-1 pb-2">Link existing sub-categories</p>
              {availableSubs.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">All sub-categories are already linked.</p>
              ) : (
                <>
                  <ScrollArea className="max-h-56">
                    <div className="space-y-1">
                      {availableSubs.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={picked.has(s.id)}
                            onCheckedChange={(v) => {
                              setPicked((prev) => {
                                const next = new Set(prev);
                                v ? next.add(s.id) : next.delete(s.id);
                                return next;
                              });
                            }}
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      disabled={picked.size === 0}
                      onClick={async () => {
                        await onAttachExisting(Array.from(picked));
                        setPicked(new Set());
                        setPickerOpen(false);
                      }}
                    >
                      Link {picked.size > 0 ? `(${picked.size})` : ""}
                    </Button>
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAdding((v) => !v); if (!isOpen) onToggle(); }}>
            <Plus className="h-3.5 w-3.5" /> Sub
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onAskDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {adding && (
        <div className="flex gap-2 my-1 ml-8">
          <Input
            autoFocus
            placeholder="New sub-category name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && childName.trim()) {
                await onAddNewSub(childName); setChildName(""); setAdding(false);
              }
              if (e.key === "Escape") { setChildName(""); setAdding(false); }
            }}
            className="h-8"
          />
          <Button
            size="sm"
            onClick={async () => {
              if (!childName.trim()) return;
              await onAddNewSub(childName); setChildName(""); setAdding(false);
            }}
          >
            Add
          </Button>
        </div>
      )}
    </>
  );
}

function SubRowView({
  sub, reuseCount, isDragging, dropPos, onRename, onAskDelete,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  sub: CategoryRow;
  reuseCount: number;
  isDragging: boolean;
  dropPos: "before" | "after" | null;
  onRename: (name: string) => Promise<void>;
  onAskDelete: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(sub.name);

  return (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 rounded-md hover:bg-muted/50 px-2 py-1.5 group border-y transition-colors ${
        isDragging ? "opacity-50 bg-muted/60" : ""
      } ${dropPos === "before" ? "border-t-primary border-b-transparent" : dropPos === "after" ? "border-b-primary border-t-transparent" : "border-transparent"}`}
    >
      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true" />
      <span className="inline-block w-4" />

      {editing ? (
        <Input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={async () => { await onRename(editValue); setEditing(false); }}
          onKeyDown={async (e) => {
            if (e.key === "Enter") { await onRename(editValue); setEditing(false); }
            if (e.key === "Escape") { setEditValue(sub.name); setEditing(false); }
          }}
          className="h-7 text-sm flex-1"
        />
      ) : (
        <span className="flex-1 text-sm">{sub.name}</span>
      )}

      {reuseCount > 1 && (
        <span className="text-[10px] text-muted-foreground rounded-full border px-1.5 py-0.5">
          in {reuseCount} categories
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onAskDelete} title="Remove">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
