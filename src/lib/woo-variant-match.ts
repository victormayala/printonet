/**
 * Map WooCommerce PDP attribute selections to Printonet inventory variant rows.
 */

export interface WooMatchVariant {
  color: string;
  colorName: string;
  hex: string;
  image?: string;
  sizes?: Array<{ size: string; price: number; qty?: number; sku?: string }>;
}

/** Prefer human labels captured from <select> (see customizer-loader). */
export function extractWooColorSelection(attrs: Record<string, string>): string | null {
  const PREFIX = "__display_";
  for (const [k, val] of Object.entries(attrs)) {
    if (!k.startsWith(PREFIX) || !val || !String(val).trim()) continue;
    const base = k.slice(PREFIX.length).toLowerCase();
    if (base.includes("color") || base.includes("colour")) {
      return String(val).trim();
    }
  }

  const rest: Array<[string, string]> = [];
  for (const [k, val] of Object.entries(attrs)) {
    if (k.startsWith(PREFIX)) continue;
    if (!val || !String(val).trim()) continue;
    rest.push([k, String(val).trim()]);
  }

  const priorityKeys = ["attribute_pa_color", "attribute_color", "pa_color"];
  const keysLower = new Map<string, string>();
  rest.forEach(([k]) => keysLower.set(k.toLowerCase(), k));
  for (const want of priorityKeys) {
    const actual = keysLower.get(want);
    if (actual) {
      const hit = rest.find(([k]) => k === actual);
      if (hit?.[1]) return hit[1];
    }
  }
  for (const [key, val] of rest) {
    const kl = key.toLowerCase();
    if (kl.includes("color") || kl.includes("colour")) return val;
  }
  return null;
}

export function slugifyLoose(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function normText(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function matchVariantFromWooColor(variants: WooMatchVariant[], wooSelected: string): WooMatchVariant | null {
  const wRaw = wooSelected.trim();
  if (!wRaw) return null;
  const wLower = wRaw.toLowerCase();
  const wSlug = slugifyLoose(wRaw);
  const wNorm = normText(wRaw);

  for (const v of variants) {
    const cLower = (v.color || "").toLowerCase();
    const nLower = (v.colorName || "").toLowerCase();
    const cSlug = slugifyLoose(v.color || "");
    const nSlug = slugifyLoose(v.colorName || "");
    const cNorm = normText(v.color || "");
    const nNorm = normText(v.colorName || "");

    if (wLower === cLower || wLower === nLower) return v;
    if (wSlug && (wSlug === cSlug || wSlug === nSlug)) return v;
    // Fuzzy fallback: "navy" should match "dark navy", "royal blue" etc.
    const cHas = cNorm.length > 0;
    const nHas = nNorm.length > 0;
    if (
      wNorm &&
      (
        (cHas && cNorm.includes(wNorm)) ||
        (nHas && nNorm.includes(wNorm)) ||
        (cHas && wNorm.includes(cNorm)) ||
        (nHas && wNorm.includes(nNorm))
      )
    ) {
      return v;
    }

    if (v.hex) {
      const hexNorm = v.hex.trim().toLowerCase();
      const wHex = wLower.startsWith("#") ? wLower : `#${wLower}`;
      if (hexNorm === wHex || hexNorm.replace(/^#/, "") === wRaw.replace(/^#/, "").toLowerCase()) return v;
    }
  }
  return null;
}
