

# Customizer Studio — Product Customization Tool

## Overview
A Printful-style product customizer where users can design custom apparel and accessories with a rich canvas editor, save their work, and order products.

## Pages & Navigation

### 1. Landing Page
- Hero section showcasing the tool with sample customized products
- "Start Designing" CTA → opens product selector
- Navigation: Logo, Browse Products, My Designs (auth-gated), Sign In

### 2. Product Selector
- Grid of product categories: T-Shirts, Hoodies, Mugs, Phone Cases, Tote Bags
- Each product shows available colors/variants
- Clicking a product opens the Design Studio

### 3. Design Studio (Core Feature)
Full-screen canvas editor with:

**Canvas Area**
- Product mockup as background (front/back views for apparel)
- Draggable/resizable design zone overlay
- Zoom and pan controls

**Left Toolbar — Design Tools**
- **Image Upload**: Drag-and-drop or file picker, with crop/resize
- **Text Tool**: Custom text with font picker (Google Fonts), size, color, alignment, arc/curve
- **Shapes**: Rectangles, circles, triangles, stars, lines — with fill/stroke color
- **Clipart Library**: Built-in icon/clipart collection organized by category
- **Drawing**: Freehand brush (stretch goal)

**Right Panel — Layers & Properties**
- Layer list with drag-to-reorder, visibility toggle, lock, delete
- Selected element properties: position, size, rotation, opacity, blend mode
- Color picker with saved swatches

**Top Bar**
- Undo/Redo
- Product color switcher
- View toggle (Front/Back for apparel)
- Save Design / Add to Cart buttons
- **Embed Mode**: Cancel / Done buttons with PNG export + postMessage

### 4. My Designs (Auth-gated)
- Grid of saved designs with thumbnails
- Load, duplicate, delete designs
- Design metadata: product type, last edited date

### 5. Cart & Checkout
- Cart showing customized products with design preview thumbnails
- Quantity selector, size/variant picker
- Order summary with pricing
- Checkout flow using Lovable's built-in payments

### 6. Auth Pages
- Sign up / Sign in (email-based via Supabase)
- Profile page with order history

### 7. Embed Route (/embed/:sessionId) ✅
- Minimal chrome — no nav, no back button
- Loads product data from customizer_sessions table
- Exports design as PNG per side on completion
- Posts result back to parent window via postMessage

### 8. Developer Integration Page (/developers) ✅
- Quick-start code snippets (HTML embed, SDK usage)
- API reference for session endpoints
- SDK reference with postMessage events

## Backend (Lovable Cloud / Supabase)

**Database Tables**
- `profiles` — user display name, avatar
- `inventory_products` — product catalog with mockup images per side ✅
- `customizer_sessions` — embeddable sessions (product_data, design_output, status) ✅
- `designs` — saved designs (product_type, canvas_data JSON, thumbnail_url, timestamps)
- `cart_items` — product, design reference, quantity, variant
- `orders` — order history linked to user

**Storage**
- `product-images` — uploaded product mockup images ✅
- `design-exports` — exported design PNGs ✅

**Edge Functions**
- `create-session` — creates a customization session from external product data ✅
- `complete-session` — stores/retrieves completed design output ✅

**Auth**
- Email/password sign-up and sign-in

## Integration SDK ✅
- `public/customizer-sdk.js` — lightweight JS file for store owners
- API: `CustomizerStudio.init()`, `.open()`, `.close()`
- Opens customizer in iframe overlay
- Communicates via `window.postMessage` with origin filtering

## Technical Approach
- Canvas rendering via **Fabric.js** (proven library for interactive canvas with objects, layers, serialization)
- Design data saved as JSON (Fabric.js canvas state) for perfect load/save
- Product mockup images with overlay positioning
- Export designs as PNG for thumbnails and order fulfillment

## Design & UX
- Clean, modern interface — dark sidebar with light canvas area
- Smooth drag-and-drop interactions
- Responsive: full experience on desktop, simplified view on tablet
- Professional feel similar to Printful/Canva editors
