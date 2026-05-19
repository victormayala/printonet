// Mint a short-lived presigned PUT URL for the VPS-hosted DAM (MinIO/S3-compatible).
// Falls back with 503 if DAM env is not configured — frontend then uses Lovable Cloud Storage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MIME = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i;
const MAX_BYTES = 25 * 1024 * 1024;

function sanitizeExt(name: string): string {
  const m = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return m && m.length <= 5 ? m : "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const endpoint = Deno.env.get("DAM_S3_ENDPOINT");
    const region = Deno.env.get("DAM_S3_REGION") || "us-east-1";
    const accessKey = Deno.env.get("DAM_S3_ACCESS_KEY");
    const secretKey = Deno.env.get("DAM_S3_SECRET_KEY");
    const publicBase = Deno.env.get("DAM_PUBLIC_BASE_URL") || endpoint;
    const bucket = "product-images";

    if (!endpoint || !accessKey || !secretKey) {
      return new Response(
        JSON.stringify({ error: "DAM not configured", configured: false }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // AuthN
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { filename, contentType, size } = body as {
      filename?: string; contentType?: string; size?: number;
    };

    if (!filename || typeof filename !== "string") {
      return new Response(JSON.stringify({ error: "filename required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ct = (contentType || "").toLowerCase();
    if (!ALLOWED_MIME.test(ct)) {
      return new Response(JSON.stringify({ error: "Unsupported content type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof size === "number" && size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "File too large (max 25MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = sanitizeExt(filename);
    const key = `tenants/${user.id}/${crypto.randomUUID()}.${ext}`;

    // Presign PUT (path-style, MinIO-friendly)
    const base = endpoint.replace(/\/+$/, "");
    const objectUrl = `${base}/${bucket}/${key}`;
    const presignUrl = `${objectUrl}?X-Amz-Expires=300`;

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      service: "s3",
      region,
    });
    const signed = await aws.sign(
      new Request(presignUrl, { method: "PUT", headers: { "Content-Type": ct } }),
      { aws: { signQuery: true } },
    );

    const publicUrl = `${publicBase.replace(/\/+$/, "")}/${bucket}/${key}`;

    return new Response(
      JSON.stringify({
        configured: true,
        upload_url: signed.url,
        public_url: publicUrl,
        key,
        expires_in: 300,
        required_headers: { "Content-Type": ct },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
