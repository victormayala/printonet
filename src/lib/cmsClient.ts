import { supabase } from "@/integrations/supabase/client";

type RpcResult<T = any> = ({ ok: true } & T) | { ok: false; error: string; status?: number };

export async function cms<T = any>(
  storeId: string,
  action: string,
  body: unknown = {},
  method: "POST" | "GET" = "POST",
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<RpcResult<T>>("cms-proxy", {
    body: { store_id: storeId, action, body, method },
  });
  if (error) throw new Error(error.message);
  if (!data || (data as any).ok === false) {
    throw new Error((data as any)?.error ?? `cms ${action} failed`);
  }
  return data as T;
}
