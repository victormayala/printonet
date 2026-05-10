/**
 * Download Supabase public `layers.json` URLs as a named file for prepress / RIP workflows.
 * Opening the URL directly in a tab shows raw JSON; this triggers a browser download instead.
 */

export function deriveLayersDownloadFilename(publicUrl: string): string {
  const u = publicUrl.trim();
  try {
    const parsed = new URL(u);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const jsonIdx = parts.findIndex((p) => p === "layers.json");
    if (jsonIdx > 0) {
      const id = parts[jsonIdx - 1];
      if (id && /^[0-9a-f-]{36}$/i.test(id)) {
        return `printonet-layers-${id}.json`;
      }
    }
  } catch {
    /* fall through */
  }
  return "printonet-layers.json";
}

export async function downloadLayersJsonUrl(publicUrl: string): Promise<void> {
  const u = publicUrl.trim();
  if (!u.startsWith("http")) {
    throw new Error("Invalid layers URL");
  }
  const res = await fetch(u, { mode: "cors", credentials: "omit" });
  if (!res.ok) {
    throw new Error(`Could not download layers file (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const name = deriveLayersDownloadFilename(u);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
