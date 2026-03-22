import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crop, RotateCcw } from "lucide-react";

export interface PrintArea {
  x: number; // percentage
  y: number;
  width: number;
  height: number;
}

interface PrintAreaEditorProps {
  imageUrl: string;
  sideLabel: string;
  value?: PrintArea | null;
  onChange: (area: PrintArea | null) => void;
}

export default function PrintAreaEditor({ imageUrl, sideLabel, value, onChange }: PrintAreaEditorProps) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const [area, setArea] = useState<PrintArea>(
    value || { x: 20, y: 15, width: 60, height: 70 }
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mx: number; my: number; area: PrintArea }>({ mx: 0, my: 0, area: { x: 0, y: 0, width: 0, height: 0 } });

  useEffect(() => {
    if (value) setArea(value);
  }, [value]);

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const handleMouseDown = (e: React.MouseEvent, type: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
    dragStartRef.current = { mx: e.clientX, my: e.clientY, area: { ...area } };
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = getContainerRect();
      if (!rect) return;
      const { mx, my, area: startArea } = dragStartRef.current;
      const dx = ((e.clientX - mx) / rect.width) * 100;
      const dy = ((e.clientY - my) / rect.height) * 100;

      if (dragging === "move") {
        const newX = Math.max(0, Math.min(100 - startArea.width, startArea.x + dx));
        const newY = Math.max(0, Math.min(100 - startArea.height, startArea.y + dy));
        setArea({ ...startArea, x: newX, y: newY });
      } else {
        const newW = Math.max(10, Math.min(100 - startArea.x, startArea.width + dx));
        const newH = Math.max(10, Math.min(100 - startArea.y, startArea.height + dy));
        setArea({ ...startArea, width: newW, height: newH });
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, getContainerRect]);

  const handleSave = () => {
    onChange({ x: Math.round(area.x), y: Math.round(area.y), width: Math.round(area.width), height: Math.round(area.height) });
    setOpen(false);
  };

  const handleReset = () => {
    onChange(null);
    setArea({ x: 20, y: 15, width: 60, height: 70 });
    setOpen(false);
  };

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
        {value ? "Edit Print Area" : "Set Print Area"}
      </Button>
      {value && (
        <span className="text-[10px] text-muted-foreground">
          {Math.round(value.width)}% × {Math.round(value.height)}%
        </span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set Print Area — {sideLabel}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Drag the rectangle to define where customers can place their designs. Resize using the bottom-right handle.
          </p>
          <div
            ref={containerRef}
            className="relative w-full aspect-square rounded-lg overflow-hidden border bg-muted select-none"
          >
            <img
              src={imageUrl}
              alt={sideLabel}
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
            {/* Dimmed overlay outside print area */}
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <mask id="print-area-mask">
                    <rect width="100" height="100" fill="white" />
                    <rect
                      x={area.x}
                      y={area.y}
                      width={area.width}
                      height={area.height}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100"
                  height="100"
                  fill="rgba(0,0,0,0.5)"
                  mask="url(#print-area-mask)"
                />
              </svg>
            </div>
            {/* Draggable print area */}
            <div
              className="absolute border-2 border-dashed border-primary cursor-move"
              style={{
                left: `${area.x}%`,
                top: `${area.y}%`,
                width: `${area.width}%`,
                height: `${area.height}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, "move")}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-primary bg-background/80 px-2 py-0.5 rounded">
                  Print Area
                </span>
              </div>
              {/* Resize handle */}
              <div
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary rounded-sm cursor-se-resize border-2 border-background"
                onMouseDown={(e) => handleMouseDown(e, "resize")}
              />
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Remove Print Area
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save Print Area
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
