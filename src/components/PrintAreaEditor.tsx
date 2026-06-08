import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crop, Plus, Trash2 } from "lucide-react";

export interface PrintArea {
  x: number; // % of image
  y: number;
  width: number;
  height: number;
}

interface PrintAreaEditorProps {
  imageUrl: string;
  sideLabel: string;
  /** Multi-area value. If a single rect is passed, it is treated as one-item array. */
  value?: PrintArea[] | PrintArea | null;
  /** Returns the updated array (empty array when none). */
  onChange: (areas: PrintArea[]) => void;
}

interface ImageBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_AREA: PrintArea = { x: 20, y: 15, width: 60, height: 70 };

function normalizeIncoming(v: PrintAreaEditorProps["value"]): PrintArea[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default function PrintAreaEditor({ imageUrl, sideLabel, value, onChange }: PrintAreaEditorProps) {
  const [open, setOpen] = useState(false);
  const [areas, setAreas] = useState<PrintArea[]>(normalizeIncoming(value));
  const [selected, setSelected] = useState<number>(0);
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; area: PrintArea }>({
    mx: 0,
    my: 0,
    area: { x: 0, y: 0, width: 0, height: 0 },
  });

  // Re-sync from props when the dialog (re)opens
  useEffect(() => {
    if (open) {
      const incoming = normalizeIncoming(value);
      setAreas(incoming);
      setSelected(incoming.length > 0 ? 0 : -1);
    }
  }, [open, value]);

  const computeImageBounds = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const rw = img.naturalWidth * scale;
    const rh = img.naturalHeight * scale;
    setImageBounds({ x: (cw - rw) / 2, y: (ch - rh) / 2, w: rw, h: rh });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(computeImageBounds);
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeImageBounds, open]);

  const updateArea = (idx: number, patch: Partial<PrintArea>) => {
    setAreas((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const areaToContainerStyle = (area: PrintArea) => {
    if (!imageBounds || !containerRef.current) {
      return {
        left: `${area.x}%`,
        top: `${area.y}%`,
        width: `${area.width}%`,
        height: `${area.height}%`,
      };
    }
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const px = imageBounds.x + (area.x / 100) * imageBounds.w;
    const py = imageBounds.y + (area.y / 100) * imageBounds.h;
    const pw = (area.width / 100) * imageBounds.w;
    const ph = (area.height / 100) * imageBounds.h;
    return {
      left: `${(px / cw) * 100}%`,
      top: `${(py / ch) * 100}%`,
      width: `${(pw / cw) * 100}%`,
      height: `${(ph / ch) * 100}%`,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, idx: number, type: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(idx);
    setDragging(type);
    dragStartRef.current = { mx: e.clientX, my: e.clientY, area: { ...areas[idx] } };
  };

  useEffect(() => {
    if (!dragging || selected < 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!imageBounds) return;
      const { mx, my, area: startArea } = dragStartRef.current;
      const dx = ((e.clientX - mx) / imageBounds.w) * 100;
      const dy = ((e.clientY - my) / imageBounds.h) * 100;

      if (dragging === "move") {
        const newX = Math.max(0, Math.min(100 - startArea.width, startArea.x + dx));
        const newY = Math.max(0, Math.min(100 - startArea.height, startArea.y + dy));
        updateArea(selected, { x: newX, y: newY });
      } else {
        const newW = Math.max(5, Math.min(100 - startArea.x, startArea.width + dx));
        const newH = Math.max(5, Math.min(100 - startArea.y, startArea.height + dy));
        updateArea(selected, { width: newW, height: newH });
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, imageBounds, selected]);

  const addArea = () => {
    // Stagger so it doesn't sit on top of the last one.
    const offset = Math.min(10, areas.length * 5);
    const newArea: PrintArea = {
      x: Math.min(80, 10 + offset),
      y: Math.min(80, 10 + offset),
      width: 30,
      height: 30,
    };
    setAreas((prev) => {
      const next = [...prev, newArea];
      setSelected(next.length - 1);
      return next;
    });
  };

  const removeArea = (idx: number) => {
    setAreas((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setSelected(Math.min(idx, next.length - 1));
      return next;
    });
  };

  const handleSave = () => {
    const cleaned = areas.map((a) => ({
      x: Math.round(a.x),
      y: Math.round(a.y),
      width: Math.round(a.width),
      height: Math.round(a.height),
    }));
    onChange(cleaned);
    setOpen(false);
  };

  const handleClearAll = () => {
    onChange([]);
    setAreas([]);
    setSelected(-1);
  };

  const existing = normalizeIncoming(value);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Crop className="h-3.5 w-3.5" />
        {existing.length > 0
          ? `Edit Print Area${existing.length > 1 ? `s (${existing.length})` : ""}`
          : "Set Print Area"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set Print Areas — {sideLabel}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Drag any rectangle to reposition, use its bottom-right handle to resize, and click another to select. Add multiple areas (e.g. front + sleeve) as needed.
          </p>
          <div
            ref={containerRef}
            className="relative w-full aspect-square rounded-lg overflow-hidden border bg-muted select-none"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt={sideLabel}
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
              onLoad={computeImageBounds}
            />
            {/* Dim outside all areas */}
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <mask id="print-areas-mask">
                    <rect width="100" height="100" fill="white" />
                    {areas.map((a, i) => {
                      if (!imageBounds || !containerRef.current) {
                        return (
                          <rect
                            key={i}
                            x={a.x}
                            y={a.y}
                            width={a.width}
                            height={a.height}
                            fill="black"
                          />
                        );
                      }
                      const cw = containerRef.current.clientWidth;
                      const ch = containerRef.current.clientHeight;
                      const px = imageBounds.x + (a.x / 100) * imageBounds.w;
                      const py = imageBounds.y + (a.y / 100) * imageBounds.h;
                      const pw = (a.width / 100) * imageBounds.w;
                      const ph = (a.height / 100) * imageBounds.h;
                      return (
                        <rect
                          key={i}
                          x={(px / cw) * 100}
                          y={(py / ch) * 100}
                          width={(pw / cw) * 100}
                          height={(ph / ch) * 100}
                          fill="black"
                        />
                      );
                    })}
                  </mask>
                </defs>
                <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask="url(#print-areas-mask)" />
              </svg>
            </div>
            {/* Draggable rectangles */}
            {areas.map((a, i) => {
              const isSel = i === selected;
              return (
                <div
                  key={i}
                  className={`absolute border-2 border-dashed cursor-move ${
                    isSel ? "border-primary" : "border-primary/40"
                  }`}
                  style={areaToContainerStyle(a)}
                  onMouseDown={(e) => handleMouseDown(e, i, "move")}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        isSel ? "text-primary bg-background/90" : "text-primary/70 bg-background/70"
                      }`}
                    >
                      Area {i + 1}
                    </span>
                  </div>
                  {isSel && (
                    <>
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeArea(i);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-label="Remove print area"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                      <div
                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary rounded-sm cursor-se-resize border-2 border-background"
                        onMouseDown={(e) => handleMouseDown(e, i, "resize")}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={addArea} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add area
            </Button>
            <span className="text-xs text-muted-foreground">
              {areas.length} print area{areas.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={areas.length === 0 && existing.length === 0}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Remove all
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
