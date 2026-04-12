import { useRef, useState, useEffect, useCallback } from "react";

interface PrintAreaOverlayProps {
  imageUrl: string;
  printArea: { x: number; y: number; width: number; height: number };
}

/**
 * Renders a dashed print-area rectangle on top of an object-contain image,
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

  if (!bounds) {
    return (
      <div ref={containerRef} className="absolute inset-0 pointer-events-none">
        <img
          ref={imgRef}
          src={imageUrl}
          className="hidden"
          onLoad={computeBounds}
          alt=""
        />
      </div>
    );
  }

  const left = bounds.x + (printArea.x / 100) * bounds.w;
  const top = bounds.y + (printArea.y / 100) * bounds.h;
  const width = (printArea.width / 100) * bounds.w;
  const height = (printArea.height / 100) * bounds.h;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <img
        ref={imgRef}
        src={imageUrl}
        className="hidden"
        onLoad={computeBounds}
        alt=""
      />
      <div
        className="absolute border-2 border-dashed border-primary/60"
        style={{ left, top, width, height }}
      />
    </div>
  );
}
