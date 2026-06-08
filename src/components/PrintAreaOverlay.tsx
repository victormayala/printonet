import { useRef, useState, useEffect, useCallback } from "react";

type Rect = { x: number; y: number; width: number; height: number };

interface PrintAreaOverlayProps {
  imageUrl: string;
  /** Single rect (legacy) or array of rects. */
  printArea: Rect | Rect[];
}

/**
 * Renders dashed print-area rectangle(s) on top of an object-contain image,
 * correctly accounting for letterboxing so coordinates match the actual image bounds.
 */
export default function PrintAreaOverlay({ imageUrl, printArea }: PrintAreaOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [bounds, setBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const computeBounds = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    const scale = Math.min(cw / nw, ch / nh);
    const renderedW = nw * scale;
    const renderedH = nh * scale;
    const offsetX = (cw - renderedW) / 2;
    const offsetY = (ch - renderedH) / 2;

    setBounds({ x: offsetX, y: offsetY, w: renderedW, h: renderedH });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(computeBounds);
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeBounds]);

  const rects: Rect[] = Array.isArray(printArea) ? printArea : [printArea];

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <img ref={imgRef} src={imageUrl} className="hidden" onLoad={computeBounds} alt="" />
      {bounds &&
        rects.map((pa, i) => {
          const left = bounds.x + (pa.x / 100) * bounds.w;
          const top = bounds.y + (pa.y / 100) * bounds.h;
          const width = (pa.width / 100) * bounds.w;
          const height = (pa.height / 100) * bounds.h;
          return (
            <div
              key={i}
              className="absolute border-2 border-dashed border-primary/60"
              style={{ left, top, width, height }}
            />
          );
        })}
    </div>
  );
}
