

## Plan: AI Design Edit Mode (non-destructive edits)

### What changes
When a user has already generated (or selected) an AI design on the canvas and types a follow-up prompt, the system sends the **existing image + the new instruction** to the AI model's image-editing endpoint. The model returns a modified version of the same design rather than a brand-new one.

### How it works

```text
User generates "A dragon logo"
  → New image appears on canvas

User types "Make the dragon blue"
  → System detects active AI design on canvas
  → Extracts its image as base64
  → Sends (image + edit prompt) to edge function
  → Model edits the existing image
  → Replaces the canvas object with the edited version
```

### Changes

**1. Edge function (`supabase/functions/generate-design/index.ts`)**
- Accept an optional `sourceImage` field (base64 data URL) in the request body
- When `sourceImage` is present, send it as a multimodal message (text + image) to the same `gemini-3.1-flash-image-preview` model with `modalities: ["image", "text"]`
- The prompt becomes an edit instruction: "Edit this design: [user prompt]. Keep the overall composition, only apply the requested change."
- When `sourceImage` is absent, behave exactly as today (generate from scratch)

**2. Design Studio UI (`src/pages/DesignStudio.tsx`)**
- Track the last AI-generated image URL in state (`lastAiImageUrl`)
- When the currently selected canvas object is an AI Design (`customName === "AI Design"`), extract its current image as a data URL
- Change the "Generate Design" button label to "Edit Design" when an AI image is selected
- On submit, call the edge function with both `prompt` and `sourceImage`
- Replace the existing canvas object's image source with the edited result (same position, scale, rotation) instead of adding a new object
- Add a small "New Design" link/button so users can opt into generating from scratch even when an AI design is selected

### Files modified
- `supabase/functions/generate-design/index.ts` — add `sourceImage` input, multimodal edit request
- `src/pages/DesignStudio.tsx` — edit-mode detection, UI label swap, image replacement logic

