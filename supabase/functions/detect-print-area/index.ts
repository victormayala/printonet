import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a product image analyst. Your job is to identify the best printable area on a product image. Look at the product (t-shirt, hoodie, mug, cap, tote bag, phone case, etc.) and identify the largest flat, unobstructed rectangular area suitable for custom printing. Avoid seams, zippers, collars, handles, edges, and curved surfaces. Return coordinates as percentages of the total image dimensions.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this product image and identify the best rectangular area for custom printing. Return the coordinates as percentage-based values (x, y from top-left corner, width, height).",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_print_area",
              description:
                "Set the detected print area coordinates as percentages of the image dimensions",
              parameters: {
                type: "object",
                properties: {
                  x: {
                    type: "number",
                    description: "X position from the left edge as a percentage (0-100)",
                  },
                  y: {
                    type: "number",
                    description: "Y position from the top edge as a percentage (0-100)",
                  },
                  width: {
                    type: "number",
                    description: "Width of the print area as a percentage (0-100)",
                  },
                  height: {
                    type: "number",
                    description: "Height of the print area as a percentage (0-100)",
                  },
                },
                required: ["x", "y", "width", "height"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_print_area" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const area = JSON.parse(toolCall.function.arguments);

    // Clamp values to valid ranges
    const printArea = {
      x: Math.max(0, Math.min(90, Math.round(area.x))),
      y: Math.max(0, Math.min(90, Math.round(area.y))),
      width: Math.max(10, Math.min(100 - Math.round(area.x), Math.round(area.width))),
      height: Math.max(10, Math.min(100 - Math.round(area.y), Math.round(area.height))),
    };

    return new Response(JSON.stringify({ printArea }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-print-area error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
