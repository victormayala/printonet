

# Remove Marketing Pages

## Summary
Delete all marketing/landing pages and the shared marketing layout. Redirect `/` to `/auth` (or `/products` if logged in). Remove related nav links and footer.

## Pages to Delete
- `src/pages/Index.tsx` — Landing page
- `src/pages/Features.tsx`
- `src/pages/Pricing.tsx`
- `src/pages/Faq.tsx`
- `src/pages/About.tsx`
- `src/pages/Integrations.tsx`
- `src/pages/Contact.tsx`
- `src/pages/Privacy.tsx`
- `src/pages/Terms.tsx`

## Components to Delete
- `src/components/MarketingLayout.tsx` — Shared header/footer for marketing pages

## Route Changes (`src/App.tsx`)
- Remove all 9 marketing route entries (`/`, `/features`, `/pricing`, `/faq`, `/about`, `/integrations`, `/contact`, `/privacy`, `/terms`)
- Remove their imports
- Change `/` to redirect to `/auth` (which already redirects to `/products` when logged in):
  ```tsx
  <Route path="/" element={<Navigate to="/auth" replace />} />
  ```

## Other Cleanup
- Check `DashboardSidebar.tsx` and `NavLink.tsx` for any links to removed pages and update them
- Remove any references to marketing pages in other components (e.g., pricing links in Auth page)

