import { useEffect, useState } from "react";

const TOKEN = "40779174228f353a03b2a7eb0a7bfa83440b79b3d28b62f5";

export default function DebugEnvPage() {
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/debug-env-${TOKEN}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <pre className="p-8 text-red-500">{error}</pre>;
  if (!data) return <div className="p-8">Loading…</div>;

  return (
    <pre className="p-8 text-xs whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
