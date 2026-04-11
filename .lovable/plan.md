

## Plan: High-Quality Print Export for AI Designs

### The Problem
- Canvas exports at **2× multiplier** on a ~600px canvas = ~1200px output
- For a 12″×16″ print area, that's only ~75-100 DPI — below professional print quality (300 DPI)
- AI-generated images from Gemini are typically ~1024×1024px, which limits the source quality
- The Print View page claims "150+ DPI recommended" but the system doesn't deliver that

### Proposed Solution: Higher Export Multiplier + AI Upscaling

**1. Increase export multiplier** (`src/pages/DesignStudio.tsx`)
- Change `multiplier: 2` → `multiplier: 4` (or even `5`) in the export options
- This gives ~2400-3000px output from a 600px canvas, reaching ~150-190 DPI for a 16″ print
- Minimal code change, immediate improvement

**2. AI-powered image upscaling edge function** (`supabase/functions/upscale-design/index.ts`)
- Create a new edge function that takes a design image and upscales it using the Gemini image model with an explicit "upscale this image to maximum resolution, preserve all details" prompt
- This can be triggered on the Print View page as an optional "Enhance for Print" button, or automatically during the export flow

**3. Update Print View** (`src/pages/PrintView.tsx`)
- Add an "Enhance for Print" button per image that calls the upscale function
- Show actual resolution/DPI info next to each downloaded file
- Update the print specs section to reflect the real output quality

### Recommendation
The simplest high-impact change is **option 1 alone** — bumping the multiplier to 4×. This doubles the current resolution with a one-line change. The AI upscaling (option 2) adds more complexity but can produce genuinely print-ready 300 DPI files.

### Files modified
- `src/pages/DesignStudio.tsx` — increase export multiplier
- `supabase/functions/upscale-design/index.ts` — new edge function for AI upscaling (optional)
- `src/pages/PrintView.tsx` — enhance button + resolution info (optional)

