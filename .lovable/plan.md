

## Rebrand: Platform → "Printonet", Customizer → "Customizer Studio" (sub-product)

The platform itself becomes **Printonet** (the SaaS dashboard print shop owners log into). **Customizer Studio** stays as the name of the embeddable product customizer feature inside Printonet.

## Scope of changes

### 1. Visible UI strings
- **Sidebar header** (`src/components/DashboardSidebar.tsx`): logo label "Customizer Studio" → "Printonet"
- **Auth page** (`src/pages/Auth.tsx`): any "Customizer Studio" headings/copy → "Printonet"
- **Dashboard pages**: replace platform-level "Customizer Studio" mentions with "Printonet". Keep "Customizer Studio" only when referring specifically to the customizer feature/embed (e.g. Developers page plugin name, embed SDK references, WooCommerce plugin section).

### 2. Browser & SEO metadata
- `index.html`: `<title>`, meta description, OG/Twitter titles & descriptions → "Printonet — [tagline]"
- Keep canonical/domain references as-is for now (no domain change requested)

### 3. Brand config
- `src/lib/brand-config.ts`: default app name → "Printonet" (keep "Customizer Studio" as the name of the customizer module if referenced separately)

### 4. What stays "Customizer Studio"
- The WordPress plugin file name (`customizer-studio-woocommerce.php`) and its UI labels — it's the customizer integration
- SDK/loader files (`customizer-loader.js`, `customizer-sdk.js`)
- Embed page, Design Studio, and any feature copy describing the customizer itself
- Asset filenames (logo SVGs) — no rename needed; just update displayed text
- Edge functions, table names, storage buckets — internal, no rename

### 5. Files to edit
- `index.html`
- `src/components/DashboardSidebar.tsx`
- `src/pages/Auth.tsx`
- `src/lib/brand-config.ts`
- Any other dashboard page with hardcoded "Customizer Studio" platform-level copy (will grep and update — likely Profile/Brand Settings page headers)

### 6. Memory update
- Update `mem://project/overview` and `mem://index.md` core to reflect: "Printonet (platform) contains Customizer Studio (embeddable customizer product)"

## Out of scope
- Domain change (still customizerstudio.com)
- Logo asset redesign
- Renaming database/edge function/storage identifiers

