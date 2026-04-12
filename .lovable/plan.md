

## Plan: AI-Powered Auto-Detect Print Areas

### What it does
When a store owner uploads a product image, they can click an "Auto-Detect Print Area" button. An AI vision model analyzes the image — identifying the garment's printable surface (e.g., the flat chest area of a t-shirt, the front panel of a hoodie) — and returns percentage-based coordinates (x, y, width, height) that get saved as the print area. The existing constraint system in the Design Studio already enforces that designs stay within print area bounds, so no changes are needed there.

### Implementation

**1. New edge function: `supabase/functions/detect-print-area/index.ts`**
- Accepts `{ imageUrl: string }` 
- Sends the product image to `google/gemini-2.5-flash` (vision-capable, fast, cost-effective) with a structured output prompt
- Uses tool calling to extract `{ x, y, width, height }` as percentages
- Returns the detected print area coordinates

**2. Update Products page: `src/pages/Products.tsx`**
- Add an "Auto-Detect" button (with a Wand/Sparkles icon) next to each "Set Print Area" button
- When clicked, sends the product image URL to the new edge function
- On success, updates `printAreas` state for that side — same data format the manual editor already uses
- Shows a loading spinner during detection
- User can still manually adjust the result via the existing PrintAreaEditor

**3. Config: `supabase/config.toml`**
- Register `detect-print-area` function with `verify_jwt = false`

### How the AI prompt works
The prompt instructs the model to look at the product photo and identify the largest flat, unobstructed area suitable for printing. It returns coordinates as percentages of the image dimensions using tool calling for reliable structured output. The model considers garment type (t-shirt, hoodie, mug, cap) and avoids seams, zippers, collars, and edges.

### Files modified
- `supabase/functions/detect-print-area/index.ts` — new edge function
- `src/pages/Products.tsx` — add "Auto-Detect" button per image side
- `supabase/config.toml` — register new function

