

## Plan: Design Templates Library + Order Management

### Feature 1: Design Templates / Clipart Library

**What it does**: Store owners can create and manage reusable design templates (pre-made layouts with text, graphics, positioning) that end-customers see in the customizer as starting points. Also includes a curated clipart/graphics library beyond the existing Lucide icons.

**New database table**: `design_templates`
- `id`, `user_id`, `name`, `description`, `category` (e.g. "Sports", "Business", "Birthday"), `thumbnail_url`, `canvas_data` (JSON — serialized Fabric.js state), `is_public` (boolean — platform-wide vs user-private), `created_at`, `updated_at`

**New storage bucket**: `template-thumbnails` (public)

**UI changes**:
1. **Dashboard: Templates page (`/templates`)** — CRUD interface for store owners to manage their templates. "Create from current design" flow that captures the current canvas state from Design Studio
2. **Design Studio: Templates panel** — New sidebar tab (alongside Clipart, Text Templates) showing browsable template cards grouped by category. Clicking one loads the full canvas state. Shows both the owner's custom templates and platform defaults
3. **Sidebar nav** — Add "Templates" link between Products and Brand Settings

**Flow**:
- Store owner designs something in Design Studio → clicks "Save as Template" → names it, picks category → canvas JSON + thumbnail PNG saved
- End-customer opens customizer → sees "Templates" tab → picks one → canvas loads with that design as a starting point, fully editable

---

### Feature 2: Order Management

**What it does**: A dashboard for store owners to view completed customizer sessions, see design previews, download print-ready files, and track status.

**Database changes**:
- Add columns to `customizer_sessions`: `customer_email` (text, nullable), `customer_name` (text, nullable), `order_notes` (text, nullable)
- Add RLS policy so authenticated users can view sessions linked to their `user_id`

**UI changes**:
1. **Dashboard: Orders page (`/orders`)** — Table/list view of completed sessions with:
   - Product name (from `product_data`)
   - Design thumbnail previews (from `design_output` image URLs)
   - Status badge (active / completed)
   - Date created
   - External reference (WooCommerce order ID)
   - "View Design" action → modal showing all side previews with download buttons
   - Filters: status, date range, search by product/reference
2. **Sidebar nav** — Add "Orders" link with a shopping bag icon

**Files to create/modify**:
- `src/pages/Templates.tsx` — New page
- `src/pages/Orders.tsx` — New page  
- `src/pages/DesignStudio.tsx` — Add "Save as Template" button + Templates panel tab
- `src/components/DashboardSidebar.tsx` — Add nav items
- `src/App.tsx` — Add routes
- `supabase/migrations/` — New migration for `design_templates` table + session columns
- `supabase/functions/create-session/index.ts` — Accept optional customer info

**Implementation order**:
1. Database migration (templates table, session columns, RLS)
2. Orders page (simpler — reads existing data)
3. Templates page (CRUD)
4. Design Studio integration (save-as-template + templates browser panel)

