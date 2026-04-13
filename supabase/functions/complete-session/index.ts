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
      const { sessionId, designOutput, uploads } = await req.json();

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

      const { data, error } = await supabase
        .from("customizer_sessions")
        .update({ design_output: designOutput, status: "completed" })
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
