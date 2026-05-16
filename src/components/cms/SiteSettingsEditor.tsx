import { TextField, TextareaField, AssetField, BoolField, ArrayField } from "./fields";
import { DEFAULT_SITE_SETTINGS } from "@/lib/cms.types";

export function SiteSettingsEditor({
  storeId,
  data,
  onChange,
}: {
  storeId: string;
  data: any;
  onChange: (next: any) => void;
}) {
  const d = { ...DEFAULT_SITE_SETTINGS, ...(data ?? {}) };
  const set = (p: any) => onChange({ ...d, ...p });
  const social = d.social_links ?? {};
  const setSocial = (p: any) => set({ social_links: { ...social, ...p } });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Announcement bar</h3>
        <BoolField
          label="Show announcement bar"
          value={!!d.announcement_enabled}
          onChange={(v) => set({ announcement_enabled: v })}
        />
        <TextField label="Text" value={d.announcement_text} onChange={(v) => set({ announcement_text: v })} maxLength={160} />
        <TextField label="Link" value={d.announcement_href} onChange={(v) => set({ announcement_href: v })} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Footer</h3>
        <TextareaField label="About" value={d.footer_about} onChange={(v) => set({ footer_about: v })} maxLength={500} />
        <ArrayField
          label="Footer columns"
          max={4}
          items={d.footer_columns ?? []}
          onChange={(footer_columns) => set({ footer_columns })}
          newItem={() => ({ title: "", links: [] })}
          itemTitle={(c: any) => c.title || "Untitled column"}
          render={(c: any, up) => (
            <>
              <TextField label="Column title *" value={c.title} onChange={(v) => up({ title: v } as any)} maxLength={60} />
              <ArrayField
                label="Links"
                max={10}
                items={c.links ?? []}
                onChange={(links) => up({ links } as any)}
                newItem={() => ({ label: "", href: "" })}
                itemTitle={(l: any) => l.label || "Link"}
                render={(l: any, lUp) => (
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Label *" value={l.label} onChange={(v) => lUp({ label: v } as any)} maxLength={60} />
                    <TextField label="Href *" value={l.href} onChange={(v) => lUp({ href: v } as any)} />
                  </div>
                )}
              />
            </>
          )}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Social links</h3>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Instagram" value={social.instagram} onChange={(v) => setSocial({ instagram: v })} />
          <TextField label="TikTok" value={social.tiktok} onChange={(v) => setSocial({ tiktok: v })} />
          <TextField label="X (Twitter)" value={social.x} onChange={(v) => setSocial({ x: v })} />
          <TextField label="Facebook" value={social.facebook} onChange={(v) => setSocial({ facebook: v })} />
          <TextField label="YouTube" value={social.youtube} onChange={(v) => setSocial({ youtube: v })} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Contact</h3>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Email" value={d.contact_email} onChange={(v) => set({ contact_email: v })} maxLength={255} />
          <TextField label="Phone" value={d.contact_phone} onChange={(v) => set({ contact_phone: v })} maxLength={40} />
        </div>
        <TextareaField label="Address" value={d.contact_address} onChange={(v) => set({ contact_address: v })} maxLength={500} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">SEO defaults</h3>
        <AssetField
          label="Default OG image"
          storeId={storeId}
          value={d.default_og_image_url}
          onChange={(v) => set({ default_og_image_url: v })}
        />
      </section>
    </div>
  );
}

export function ContentPageEditor({
  storeId,
  data,
  onChange,
}: {
  storeId: string;
  data: any;
  onChange: (next: any) => void;
}) {
  const d = data ?? {};
  const set = (p: any) => onChange({ ...d, ...p });
  return (
    <div className="space-y-3">
      <TextField label="Title *" value={d.title} onChange={(v) => set({ title: v })} maxLength={160} />
      <TextareaField
        label="Body (Markdown)"
        value={d.body_md}
        onChange={(v) => set({ body_md: v })}
        rows={14}
        className="font-mono text-xs"
        maxLength={100_000}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="SEO title" value={d.seo_title} onChange={(v) => set({ seo_title: v })} maxLength={160} />
        <TextField label="SEO description" value={d.seo_description} onChange={(v) => set({ seo_description: v })} maxLength={320} />
      </div>
      <AssetField label="OG image" storeId={storeId} value={d.og_image_url} onChange={(v) => set({ og_image_url: v })} />
    </div>
  );
}
