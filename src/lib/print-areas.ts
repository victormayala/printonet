export type PrintAreaRect = { x: number; y: number; width: number; height: number };

/** A stored print_areas[view] value may legacy-be a single rect or an array. */
export type StoredPrintArea = PrintAreaRect | PrintAreaRect[] | null | undefined;

/** Always return an array (possibly empty) of rects. */
export function toPrintAreaArray(value: StoredPrintArea): PrintAreaRect[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(
      (v) =>
        v &&
        typeof v.x === "number" &&
        typeof v.y === "number" &&
        typeof v.width === "number" &&
        typeof v.height === "number",
    );
  }
  if (
    typeof value === "object" &&
    typeof (value as PrintAreaRect).x === "number" &&
    typeof (value as PrintAreaRect).width === "number"
  ) {
    return [value as PrintAreaRect];
  }
  return [];
}

/** Convert the full `print_areas` JSON into a normalized {view: rect[]} map. */
export function normalizePrintAreasMap(
  raw: Record<string, StoredPrintArea> | null | undefined,
): Record<string, PrintAreaRect[]> {
  const out: Record<string, PrintAreaRect[]> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    const arr = toPrintAreaArray(v);
    if (arr.length > 0) out[k] = arr;
  }
  return out;
}

/** Bounding union of an array of rects, clamped to 0-100. Returns null if empty. */
export function unionPrintAreas(areas: PrintAreaRect[]): PrintAreaRect | null {
  if (!areas || areas.length === 0) return null;
  if (areas.length === 1) return areas[0];
  let minX = 100;
  let minY = 100;
  let maxX = 0;
  let maxY = 0;
  for (const a of areas) {
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + a.width);
    maxY = Math.max(maxY, a.y + a.height);
  }
  return {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    width: Math.min(100, maxX) - Math.max(0, minX),
    height: Math.min(100, maxY) - Math.max(0, minY),
  };
}
