import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Upload, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";
import { cms } from "@/lib/cmsClient";
import { toast } from "@/hooks/use-toast";

type Base = { label: string; help?: string };

export function TextField({
  label,
  help,
  value,
  onChange,
  placeholder,
  maxLength,
}: Base & { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}

export function TextareaField({
  label,
  help,
  value,
  onChange,
  rows = 4,
  placeholder,
  maxLength,
  className,
}: Base & {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={className}
      />
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}

export function BoolField({
  label,
  value,
  onChange,
  help,
}: Base & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <Label className="text-sm">{label}</Label>
        {help && <p className="text-[11px] text-muted-foreground mt-0.5">{help}</p>}
      </div>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: Base & { value: T; onChange: (v: T) => void; options: { label: string; value: T }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AssetField({
  label,
  storeId,
  value,
  onChange,
  help,
}: Base & { storeId: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const signed = await cms<{ upload_url: string; public_url: string }>(
        storeId,
        "create-asset-upload-url",
        {
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size: file.size,
        },
      );
      const putRes = await fetch(signed.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      onChange(signed.public_url);
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
          className="flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          title="Upload image"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            title="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value ? (
        <div className="mt-2 inline-block rounded-md border bg-muted/30 p-1">
          {/^https?:/.test(value) ? (
            <img src={value} alt="" className="h-20 w-20 object-cover rounded" />
          ) : (
            <div className="h-20 w-20 flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>
      ) : null}
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}

export function ArrayField<T>({
  label,
  items,
  onChange,
  min = 0,
  max = 99,
  newItem,
  render,
  itemTitle,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  min?: number;
  max?: number;
  newItem: () => T;
  render: (item: T, update: (patch: Partial<T>) => void, idx: number) => React.ReactNode;
  itemTitle?: (item: T, idx: number) => string;
}) {
  const arr = items ?? [];
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const update = (i: number, patch: Partial<T>) => {
    const next = [...arr];
    next[i] = { ...(next[i] as any), ...patch };
    onChange(next);
  };
  const remove = (i: number) => {
    if (arr.length <= min) return;
    onChange(arr.filter((_, k) => k !== i));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {label} <span className="text-muted-foreground font-normal">({arr.length}/{max})</span>
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...arr, newItem()])}
          disabled={arr.length >= max}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="space-y-3">
        {arr.map((item, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {itemTitle ? itemTitle(item, i) : `Item ${i + 1}`}
              </span>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === arr.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(i)}
                  disabled={arr.length <= min}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {render(item, (patch) => update(i, patch), i)}
          </div>
        ))}
        {arr.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No items yet.</p>
        )}
      </div>
    </div>
  );
}
