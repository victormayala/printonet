
## Use the long Printonet logo in the sidebar

Replace the small icon-only logo currently shown in the sidebar header with the full horizontal "Printonet" logo (`src/assets/printonet-logo.svg`), recolored so it reads correctly on the dark sidebar background.

### What will change

- The sidebar header (top-left, above the nav items) will display the full long-form Printonet logo instead of just the icon mark.
- When the sidebar is expanded: the full horizontal logo (icon + "Printonet" wordmark) is shown.
- When the sidebar is collapsed: it falls back to the icon-only sidebar logo so it still fits in the narrow rail.
- The yellow accent in the logo stays yellow; the rest of the artwork is white so it stands out on the dark sidebar.

### Technical details

1. Create a new asset `src/assets/printonet-logo-sidebar-full.svg` based on the existing `src/assets/printonet-logo.svg`, with all dark/black fills swapped to white (`#FFFFFF`) and the yellow accent preserved (`#FDD100`). This avoids touching the original logo used elsewhere (landing page, etc.).
2. Update `src/components/DashboardSidebar.tsx`:
   - Import both the full sidebar logo and the existing icon-only sidebar logo.
   - In the header `<div>`, render the full logo when `!collapsed`, and the icon-only logo when `collapsed`.
   - Adjust sizing: full logo uses `h-7 w-auto` so it scales naturally; icon logo keeps `h-7 w-7`.
   - No other layout changes; the existing border and padding stay the same.

### Files

- `src/assets/printonet-logo-sidebar-full.svg` (new)
- `src/components/DashboardSidebar.tsx` (modified)
