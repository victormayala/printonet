/**
 * Cross-origin WooCommerce AJAX add-to-cart from the hosted SPA (e.g. platform.printonet.com).
 * Requires tenant MU-plugin CORS + SameSite=None session cookies (see printonet-core).
 */
export interface WooCartLineInput {
  wcProductId?: string;
  wcVariationId?: string;
  wcAttributes?: Record<string, string>;
  productName?: string;
  quantity: number;
  sessionId: string;
  previewImage: string | null;
}

export interface WooAjaxAddResult {
  ok: boolean;
  error?: string;
  product_url?: string;
}

export interface StagedCartTransferResult {
  ok: boolean;
  error?: string;
  redirectUrl?: string;
}

/**
 * Reliable cross-origin cart sync: POST lines to the store REST API (no cookies), then redirect the
 * browser to the store first‑party so WooCommerce runs add_to_cart under a normal session.
 */
export async function transferHostedCartToWoo(
  storeOrigin: string,
  lines: WooCartLineInput[],
): Promise<StagedCartTransferResult> {
  const base = storeOrigin.replace(/\/$/, "");
  const url = `${base}/wp-json/printonet/v1/stage-hosted-cart`;

  const body = {
    items: lines.map((line) => ({
      wc_product_id: line.wcProductId ? parseInt(String(line.wcProductId), 10) : 0,
      wc_variation_id: line.wcVariationId ? parseInt(String(line.wcVariationId), 10) : 0,
      wc_attributes: line.wcAttributes && typeof line.wcAttributes === "object" ? line.wcAttributes : {},
      product_name: line.productName || "",
      quantity: Math.max(1, line.quantity || 1),
      session_id: line.sessionId,
      preview_image: line.previewImage || "",
    })),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "omit",
      mode: "cors",
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network";
    return { ok: false, error: msg };
  }

  let data: { success?: boolean; redirect_url?: string; message?: string };
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "invalid_response" };
  }

  if (!res.ok || !data.success || typeof data.redirect_url !== "string") {
    return {
      ok: false,
      error: typeof data.message === "string" ? data.message : `http_${res.status}`,
    };
  }

  return { ok: true, redirectUrl: data.redirect_url };
}

export async function wooAjaxAddToCart(storeOrigin: string, line: WooCartLineInput): Promise<WooAjaxAddResult> {
  const base = storeOrigin.replace(/\/$/, "");
  const url = `${base}/?wc-ajax=add_to_cart`;

  const fd = new FormData();
  fd.append("product_id", String(line.wcProductId));
  fd.append("quantity", String(Math.max(1, line.quantity)));

  if (line.wcVariationId) {
    fd.append("variation_id", String(line.wcVariationId));
  }
  if (line.wcAttributes && typeof line.wcAttributes === "object") {
    Object.keys(line.wcAttributes).forEach((k) => {
      const key = k.indexOf("attribute_") === 0 ? k : `attribute_pa_${k}`;
      fd.append(key, String(line.wcAttributes![k]));
    });
  }

  fd.append("customizer_session_id", line.sessionId);
  if (line.previewImage) {
    fd.append("customizer_design_url", line.previewImage);
    fd.append(
      "customizer_sides",
      JSON.stringify([{ view: "front", url: line.previewImage, preview_url: line.previewImage }]),
    );
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: fd, credentials: "include", mode: "cors" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network";
    return { ok: false, error: msg };
  }

  let data: { error?: boolean; product_url?: string; message?: string };
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "invalid_response" };
  }

  if (data.error) {
    return {
      ok: false,
      error: typeof data.message === "string" ? data.message : "woo_error",
      product_url: typeof data.product_url === "string" ? data.product_url : undefined,
    };
  }

  return { ok: true };
}

export function storeOriginFromReturnUrl(returnUrl: string): string | null {
  if (!returnUrl.startsWith("http")) return null;
  try {
    return new URL(returnUrl).origin;
  } catch {
    return null;
  }
}
