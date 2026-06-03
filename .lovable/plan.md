## Goal

Default every user to a "Customizer only" experience. As super admin, toggle a per-user flag that unlocks the Hosted Stores features (My Stores nav group, Shopify/WooCommerce/hosted store routes).

## Backend

1. New migration: add `hosted_stores_enabled boolean not null default false` to `public.profiles`.
2. New SQL function `public.admin_set_hosted_stores_enabled(p_user_id uuid, p_enabled boolean)` — super_admin only, updates the flag.
3. Update `public.admin_list_users()` to also return `hosted_stores_enabled` from profiles.
4. No RLS change needed (profiles already readable by owner); flag is server-controlled via the RPC.

## Frontend

1. New hook `useHostedStoresEnabled()` — reads `profiles.hosted_stores_enabled` for the current user (super admins always true). Cached via React Query.
2. `DashboardSidebar.tsx`: hide the "My Stores" nav item and the "Orders" item gating? — keep Orders visible, only gate the **My Stores** group behind the flag.
3. `App.tsx`: for users without the flag, redirect `/corporate-stores`, `/corporate-stores/:id`, `/websites/:id`, `/storefront`, `/customizer*`, `/brand-settings`, `/developers` to `/dashboard` (admins and enabled users keep current behavior).
4. `Dashboard.tsx` and any tiles that surface hosted-store CTAs: hide those sections when the flag is off. (Will audit and gate visually; no business logic change.)
5. `AdminUsers.tsx`:
   - Add a new "Hosted stores" column with a `Switch` per user.
   - Toggling calls `admin_set_hosted_stores_enabled` RPC and invalidates `admin-users`.
   - Super admins show as always-on (disabled switch).

## Out of scope

- No change to billing/plan limits. The flag is purely a visibility/access gate controlled by the admin.
- Admin sidebar tab stays hidden (per previous request).

## Open question

Should users without the flag still be able to reach **Orders** and **Catalog (Products/Categories/Suppliers)**? My read of your message: yes — they keep Dashboard + Catalog + Orders + Profile, and only "My Stores" (hosted stores, Shopify, WooCommerce) is gated. Confirm or tell me to gate Catalog/Orders too.
