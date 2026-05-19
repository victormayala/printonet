import { supabase } from "@/integrations/supabase/client";

/**
 * Upload an image to the VPS-hosted DAM (MinIO) via a signed PUT URL.
 * Falls back to Lovable Cloud Storage `product-images` bucket if the DAM is
 * not configured (edge function returns 503) or any DAM step fails.
 *
 * Returns the public URL to store in the DB.
 */
export async function uploadProductImage(
  file: File,
  fallbackPath: string,
): Promise<string> {
  // 1. Try DAM
  try {
    const { data, error } = await supabase.functions.invoke("dam-sign-upload", {
      body: {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      },
    });

    if (!error && data?.configured && data?.upload_url && data?.public_url) {
      const putRes = await fetch(data.upload_url, {
        method: "PUT",
        headers: data.required_headers ?? { "Content-Type": file.type },
        body: file,
      });
      if (putRes.ok) return data.public_url as string;
      // PUT failed — fall through to Lovable Cloud
      console.warn("[DAM] PUT failed, falling back to Lovable Cloud:", putRes.status);
    }
  } catch (e) {
    console.warn("[DAM] sign-upload unavailable, falling back:", e);
  }

  // 2. Fallback: Lovable Cloud Storage
  const { error: upErr } = await supabase.storage
    .from("product-images")
    .upload(fallbackPath, file);
  if (upErr) throw upErr;
  return supabase.storage.from("product-images").getPublicUrl(fallbackPath).data.publicUrl;
}
