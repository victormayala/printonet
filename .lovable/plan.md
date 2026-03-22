

## Plan: Print Areas per Product Side

### What it does
Store owners define a rectangular "print area" on each product side (front, back, left, right) that constrains where end-customers can place design elements. In the Design Studio, a visible dashed boundary shows the printable zone, and all objects are clipped to stay within it.

### How it works

```text
┌─────────────────────────┐
│  Product Image (T-Shirt)│
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  │   PRINT AREA      │  │  ← dashed border, objects constrained here
│  │   (user designs)   │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
└─────────────────────────┘
```

### Database changes

Add a `print_areas` JSONB column to `inventory_products`:
```sql
ALTER TABLE public.inventory_products 
  ADD COLUMN print_areas jsonb DEFAULT '{}'::jsonb;
```

Format: `{ "front": { "x": 25, "y": 15, "width": 50, "height": 60 }, "back": {...} }`  
Values are **percentages** of the product image dimensions, making them resolution-independent.

### Implementation details

**1. Product Form — Print Area Editor** (`Products.tsx`)
- For each side that has an image, add a "Set Print Area" button
- Opens a visual editor: the product image is shown with a draggable/resizable rectangle overlay
- Store owner drags to define the printable zone → saved as percentage coordinates in `print_areas`
- Default: no print area = full canvas is available (backward compatible)

**2. Design Studio — Print Area Enforcement** (`DesignStudio.tsx`)
- On view load, read the print area config for the current side from `product_data.print_areas` (embed) or `invProduct.print_areas` (dashboard)
- Render a **non-interactive dashed rectangle** on the canvas marking the boundary (using a Fabric.js `Rect` with `evented: false, selectable: false`)
- Use Fabric.js `clipPath` on the canvas or constrain object movement via `object:moving` / `object:scaling` events to keep objects within the print area bounds
- The print area rect is excluded from exports (filtered out before `toDataURL`)

**3. Data flow for embed/SDK sessions**
- `EmbedProductData` interface gains optional `print_areas` field
- `create-session` edge function already passes `product_data` through — print areas flow automatically since they're part of the product JSON
- SDK `open()` product object can include `print_areas`

**4. Export adjustments**
- On export, only the area within the print zone is exported (crop the canvas to the print area bounds before `toDataURL`)
- The dashed boundary rect is removed/hidden before export

### Files to modify
- **Migration**: New migration adding `print_areas` column to `inventory_products`
- **`src/pages/Products.tsx`**: Add visual print area editor in ProductForm per image side
- **`src/pages/DesignStudio.tsx`**: Render print area boundary, constrain objects, crop export
- **`src/pages/EmbedCustomizer.tsx`**: Pass `print_areas` through from session data
- **`src/integrations/supabase/types.ts`**: Auto-updated after migration

### Implementation order
1. Database migration (add `print_areas` column)
2. Design Studio print area rendering + object constraining
3. Product Form print area visual editor
4. Export cropping to print area bounds

