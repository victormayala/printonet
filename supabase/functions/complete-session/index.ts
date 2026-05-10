import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64ToUint8Array(base64: string): Uint8Array {
  // Strip data URL prefix if present
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "POST") {
      const body = await req.json();
      const { sessionId, designOutput, uploads, layersJson } = body;

      if (!sessionId || !designOutput) {
        return new Response(
          JSON.stringify({ error: "sessionId and designOutput are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Handle file uploads if provided (base64 data URLs -> storage)
      if (uploads && Array.isArray(uploads)) {
        for (const upload of uploads) {
          if (!upload.dataUrl || !upload.fileName) continue;
          try {
            const bytes = base64ToUint8Array(upload.dataUrl);
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("design-exports")
              .upload(upload.fileName, bytes, { contentType: "image/png", upsert: true });

            if (uploadData && !uploadError) {
              const publicUrl = supabase.storage
                .from("design-exports")
                .getPublicUrl(uploadData.path).data.publicUrl;
              // Replace dataUrl references in designOutput with public URL
              if (upload.sideIndex !== undefined && upload.field) {
                const side = designOutput.sides?.[upload.sideIndex];
                if (side) {
                  side[upload.field] = publicUrl;
                }
              }
            }
          } catch (uploadErr) {
            console.warn(`Upload failed for ${upload.fileName}:`, uploadErr);
          }
        }
      }

      let mergedDesignOutput: Record<string, unknown> = {
        ...(typeof designOutput === "object" && designOutput !== null
          ? (designOutput as Record<string, unknown>)
          : {}),
      };

      const existingLayers = String(
        mergedDesignOutput["designLayersUrl"] ??
          mergedDesignOutput["design_layers_url"] ??
          "",
      ).trim();
      if (
        existingLayers === "" &&
        typeof layersJson === "string" &&
        layersJson.length > 0 &&
        layersJson.length <= 12 * 1024 * 1024
      ) {
        try {
          const path = `${sessionId}/layers.json`;
          const bytes = new TextEncoder().encode(layersJson);
          const { data: upData, error: upErr } = await supabase.storage
            .from("design-exports")
            .upload(path, bytes, { contentType: "application/json", upsert: true });

          if (upErr) {
            console.warn("layersJson storage upload error:", upErr.message);
          }
          if (upData && !upErr) {
            const publicUrl = supabase.storage
              .from("design-exports")
              .getPublicUrl(upData.path).data.publicUrl;
            mergedDesignOutput = { ...mergedDesignOutput, designLayersUrl: publicUrl };
          }
        } catch (e) {
          console.warn("layersJson upload failed:", e);
        }
      }

      const sidesArr = mergedDesignOutput["sides"];
      if (Array.isArray(sidesArr)) {
        const hit = sidesArr.find(
          (s: unknown) =>
            s &&
            typeof s === "object" &&
            typeof (s as { designPNG?: string }).designPNG === "string" &&
            /^https?:\/\//i.test(((s as { designPNG: string }).designPNG || "").trim()),
        ) as { designPNG?: string } | undefined;
        if (hit?.designPNG) {
          mergedDesignOutput = { ...mergedDesignOutput, printFileUrl: hit.designPNG.trim() };
        }
      }

      const { data, error } = await supabase
        .from("customizer_sessions")
        .update({ design_output: mergedDesignOutput, status: "completed" })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          sessionId: data.id,
          status: data.status,
          designOutput: data.design_output,
          externalRef: data.external_ref,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET — retrieve session by id query param
    if (req.method === "GET") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");

      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "sessionId query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("customizer_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          sessionId: data.id,
          status: data.status,
          productData: data.product_data,
          designOutput: data.design_output,
          externalRef: data.external_ref,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
