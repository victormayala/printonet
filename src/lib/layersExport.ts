/**
 * Design layers file written to Supabase Storage (design-exports/{sessionId}/layers.json).
 * v1: sides[].canvasJSON as string (double-encoded Fabric JSON — large and slow in browsers).
 * v2: sides[].canvas as parsed object (preferred).
 */

export type LayersExportSide = {
  view: string;
  /** Fabric canvas document — parsed JSON object */
  canvas: unknown;
  printArea?: { x: number; y: number; width: number; height: number };
};

export type LayersExportPayload = {
  v: 2;
  sessionId?: string;
  exportedAt: string;
  sides: LayersExportSide[];
};

function safeParseCanvasJson(canvasJSON: string | undefined): unknown {
  if (!canvasJSON || !canvasJSON.trim()) {
    return {};
  }
  try {
    return JSON.parse(canvasJSON) as unknown;
  } catch {
    return { _parseError: true, _rawLength: canvasJSON.length };
  }
}

/**
 * Compact JSON string for storage (single line, no double-escaped inner JSON).
 */
export function buildLayersExportJson(
  sessionId: string | undefined,
  sides: Array<{ view: string; canvasJSON?: string; printArea?: LayersExportSide["printArea"] }>,
): string {
  const payload: LayersExportPayload = {
    v: 2,
    sessionId,
    exportedAt: new Date().toISOString(),
    sides: sides.map((s) => ({
      view: s.view,
      canvas: safeParseCanvasJson(s.canvasJSON),
      printArea: s.printArea,
    })),
  };
  return JSON.stringify(payload);
}
