// Best-effort apparel color name → hex mapping.
// Used by supplier importers (SanMar / S&S Activewear) when the source feed
// doesn't expose a swatch hex, so the storefront can still render color circles
// instead of empty outlined dots.
//
// Keys are normalized: lowercased, trimmed, runs of whitespace/hyphens/slashes
// collapsed to a single space. Values are 6-digit hex without leading "#".

const RAW: Record<string, string> = {
  // ── Neutrals ──────────────────────────────────────────────────────────
  "white": "ffffff",
  "natural": "f5ecd9",
  "ivory": "fffff0",
  "cream": "f5f0e1",
  "bone": "ece5d3",
  "sand": "d9c7a3",
  "khaki": "c3b091",
  "stone": "b8a78b",
  "tan": "d2b48c",
  "beige": "d9c7a3",
  "putty": "c9b89a",
  "cardinal": "c41e3a",

  // ── Greys & blacks ────────────────────────────────────────────────────
  "black": "111111",
  "true black": "000000",
  "jet black": "0a0a0a",
  "deep black": "0a0a0a",
  "charcoal": "36454f",
  "charcoal heather": "3f4348",
  "dark grey": "4d4d4d",
  "dark gray": "4d4d4d",
  "graphite": "474a51",
  "graphite heather": "5a5d63",
  "grey": "808080",
  "gray": "808080",
  "athletic heather": "9aa0a3",
  "heather grey": "9aa0a3",
  "heather gray": "9aa0a3",
  "sport grey": "9aa0a3",
  "sport gray": "9aa0a3",
  "light grey": "c0c0c0",
  "light gray": "c0c0c0",
  "ash": "cdcec9",
  "silver": "c0c5c8",
  "smoke grey": "737373",
  "smoke gray": "737373",
  "steel grey": "555c66",
  "steel gray": "555c66",
  "iron grey": "434b53",
  "iron gray": "434b53",
  "pewter": "8a8d8f",

  // ── Blues ─────────────────────────────────────────────────────────────
  "navy": "0a1f44",
  "true navy": "0a1f44",
  "deep navy": "0a1f44",
  "dark navy": "081229",
  "classic navy": "0a1f44",
  "midnight navy": "0a1834",
  "royal": "1f3da5",
  "true royal": "1f3da5",
  "royal blue": "1f3da5",
  "deep royal": "1a2f8a",
  "blue": "1f6fb5",
  "athletic royal": "1f3da5",
  "carolina blue": "56a0d3",
  "columbia blue": "9ec8e8",
  "light blue": "add8e6",
  "powder blue": "b0d4e3",
  "sky blue": "87ceeb",
  "sky": "87ceeb",
  "aqua": "00b7c2",
  "turquoise": "30d5c8",
  "teal": "138c8c",
  "dark teal": "0f6c6c",
  "deep teal": "0f6c6c",
  "tropic blue": "0080a8",
  "tropical blue": "0080a8",
  "indigo": "3f51b5",
  "denim": "3b5a7a",
  "atlantic blue": "1d5b8e",
  "marine blue": "0e3a66",
  "midnight blue": "13243d",
  "cobalt": "1d3fa3",
  "electric blue": "1f6fdb",
  "royal heather": "2f4ba8",
  "navy heather": "1c2a4d",
  "slate blue": "5a6e8c",
  "steel blue": "4682b4",
  "periwinkle": "8a9bd1",
  "peri": "8a9bd1",

  // ── Reds / pinks ──────────────────────────────────────────────────────
  "red": "c8102e",
  "true red": "c8102e",
  "deep red": "9b1424",
  "dark red": "8b0a14",
  "athletic red": "c8102e",
  "team red": "c8102e",
  "scarlet": "d8232a",
  "crimson": "990000",
  "burgundy": "6b1922",
  "maroon": "5c1a1b",
  "cardinal red": "c41e3a",
  "wine": "722f37",
  "garnet": "7a1830",
  "berry": "8d2c5e",
  "cranberry": "9b1d3a",
  "pink": "ec4899",
  "neon pink": "ff6fb5",
  "hot pink": "ff3d7f",
  "pink raspberry": "c2185b",
  "raspberry": "c2185b",
  "light pink": "ffd1dc",
  "pale pink": "f8d3dd",
  "candy pink": "f783ac",
  "magenta": "d6336c",
  "fuchsia": "d6336c",
  "rose": "d97a8c",
  "blush": "e8b4b8",
  "coral": "ff7f5c",
  "deep coral": "e95a3c",
  "salmon": "fa8072",
  "peach": "ffcba4",

  // ── Greens ────────────────────────────────────────────────────────────
  "green": "008550",
  "kelly": "1c7847",
  "kelly green": "1c7847",
  "irish green": "1c7847",
  "athletic green": "1c7847",
  "true green": "1c7847",
  "forest": "1a3a26",
  "forest green": "1a3a26",
  "dark green": "1f4023",
  "deep forest": "152b1c",
  "hunter": "284e36",
  "hunter green": "284e36",
  "olive": "6b6e3a",
  "olive green": "6b6e3a",
  "army": "4b5320",
  "military green": "4b5320",
  "moss": "748b53",
  "moss green": "748b53",
  "sage": "9caf88",
  "sage green": "9caf88",
  "mint": "a8e6c9",
  "lime": "a4d65e",
  "neon green": "39ff14",
  "safety green": "ccff00",
  "lime shock": "ccff36",
  "kiwi": "9bc24a",
  "emerald": "0f8a5f",
  "jade": "00a878",
  "seafoam": "9fe2bf",
  "evergreen": "234035",

  // ── Yellows / oranges ─────────────────────────────────────────────────
  "yellow": "ffd200",
  "athletic gold": "f3c100",
  "gold": "d4a017",
  "vegas gold": "c5b358",
  "old gold": "cfb53b",
  "mustard": "d6a72e",
  "amber": "f0a830",
  "orange": "ff6f1a",
  "burnt orange": "cc5500",
  "deep orange": "d94e1f",
  "texas orange": "bf5700",
  "tennessee orange": "ff8200",
  "safety orange": "ff7900",
  "neon orange": "ff6f00",
  "tangerine": "f28500",
  "rust": "b7410e",
  "copper": "b87333",
  "bronze": "8c6a3d",
  "brown": "6b4226",
  "dark chocolate": "3b2418",
  "chocolate": "5a3a26",
  "espresso": "4b3621",
  "cocoa": "5e3a1f",
  "coyote brown": "8a6b4c",

  // ── Purples ───────────────────────────────────────────────────────────
  "purple": "5e2a84",
  "team purple": "5e2a84",
  "deep purple": "4a1f6b",
  "dark purple": "3d1a5c",
  "violet": "6a3aa8",
  "lavender": "b497c4",
  "lilac": "c8a2c8",
  "plum": "5a2960",
  "eggplant": "4a2255",
  "orchid": "9b59b6",

  // ── Misc / overrides ──────────────────────────────────────────────────
  "clear": "f4f4f0",
  "multi": "9aa0a3",
  "camouflage": "78866b",
  "camo": "78866b",
  "realtree": "5a4a2a",
};

function normalize(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[_\-/]+/g, " ")
    .replace(/\s+/g, " ");
}

function isValidHex(h: unknown): h is string {
  if (typeof h !== "string") return false;
  const v = h.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(v);
}

/**
 * Resolve a color name → "#RRGGBB". Returns null if nothing reasonable matches.
 * Strategy:
 *  1) exact normalized match
 *  2) strip common modifiers ("heather", "athletic", "true", "deep", "dark",
 *     "light", "neon", "vintage", "classic") and retry
 *  3) substring containment — try the longest dictionary key contained in the
 *     input, then the longest dictionary key that contains the input
 */
export function colorNameToHex(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  const n = normalize(rawName);
  if (!n) return null;

  if (RAW[n]) return `#${RAW[n]}`;

  const stripped = n
    .replace(/\b(heather|athletic|true|deep|dark|light|neon|vintage|classic|safety|sport|team|bright|pale|soft|electric)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && stripped !== n && RAW[stripped]) return `#${RAW[stripped]}`;

  const keys = Object.keys(RAW).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (n.includes(k)) return `#${RAW[k]}`;
  }
  for (const k of keys) {
    if (k.includes(n) && n.length >= 3) return `#${RAW[k]}`;
  }
  return null;
}

/**
 * Pick the best hex for a variant: prefer the supplier-provided value if it
 * looks valid, otherwise fall back to the name lookup.
 */
export function resolveVariantHex(
  rawName: string | null | undefined,
  supplierHex: string | null | undefined,
): string | null {
  if (isValidHex(supplierHex)) {
    const v = supplierHex!.trim();
    return v.startsWith("#") ? v : `#${v}`;
  }
  return colorNameToHex(rawName);
}
