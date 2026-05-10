export type VariantViewSide = "front" | "back" | "side1" | "side2";

function viewSignatureFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = String(url).match(/\/[^/]+_([^/_]+)_[^/_]+(?:\.[a-zA-Z0-9]+)(?:\?.*)?$/);
  return m?.[1]?.toLowerCase() || null;
}

/**
 * Resolve the best gallery image for a specific side, preferring exact signature
 * matches against the product base side URL.
 */
export function resolveGalleryImageForView(
  gallery: string[] | null | undefined,
  baseViewUrl: string | null | undefined,
  view: VariantViewSide,
): string | null {
  if (!Array.isArray(gallery) || gallery.length === 0) return null;

  const baseSig = viewSignatureFromUrl(baseViewUrl || null);
  if (baseSig) {
    const bySig = gallery.find((u) => viewSignatureFromUrl(u) === baseSig);
    if (bySig) return bySig;
  }

  const tokenHints: Record<VariantViewSide, string[]> = {
    front: ["_f_fl", "_f_"],
    back: ["_b_fl", "_b_"],
    side1: ["_oms_fl", "_s_fl", "_l_fl"],
    side2: ["_d_fl", "_r_fl"],
  };
  for (const hint of tokenHints[view] || []) {
    const hit = gallery.find((u) => String(u).toLowerCase().includes(hint));
    if (hit) return hit;
  }
  return null;
}
