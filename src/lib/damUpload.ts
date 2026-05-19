import { supabase } from "@/integrations/supabase/client";

/**
 * Upload an image to the VPS-hosted DAM (MinIO) via a signed PUT URL.
 * Falls back to Lovable Cloud Storage `product-images` bucket only when the
 * DAM is not configured. If the DAM is configured but upload fails, surface
 * the error instead of silently storing a Lovable Cloud URL.
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

    if (error) {
      if (error.context?.status === 503) {
        console.warn("[DAM] not configured, falling back to Lovable Cloud");
      } else {
        throw new Error(error.message || "DAM signing failed");
      }
    } else if (data?.configured && data?.upload_url && data?.public_url) {
      const putRes = await fetch(data.upload_url, {
        method: "PUT",
        headers: data.required_headers ?? { "Content-Type": file.type },
        body: file,
      });
      if (putRes.ok) return data.public_url as string;
      const details = await putRes.text().catch(() => "");
      throw new Error(`DAM upload failed (${putRes.status})${details ? `: ${details.slice(0, 160)}` : ""}`);
    } else if (data?.configured === false) {
      console.warn("[DAM] not configured, falling back to Lovable Cloud");
    } else {
      throw new Error("DAM signing returned an invalid response");
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error("DAM upload failed");
  }

  // 2. Fallback: Lovable Cloud Storage
  // RLS requires the first folder segment to equal the auth user id.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to upload images.");
  const scopedPath = fallbackPath.startsWith(`${user.id}/`)
    ? fallbackPath
    : `${user.id}/${fallbackPath}`;
  const { error: upErr } = await supabase.storage
    .from("product-images")
    .upload(scopedPath, file);
  if (upErr) throw upErr;
  return supabase.storage.from("product-images").getPublicUrl(scopedPath).data.publicUrl;
}
