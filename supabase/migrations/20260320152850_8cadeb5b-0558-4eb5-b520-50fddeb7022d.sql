
-- Brand configs table
CREATE TABLE public.brand_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  logo_url text,
  theme text NOT NULL DEFAULT 'dark',
  primary_color text NOT NULL DEFAULT '#7c3aed',
  accent_color text NOT NULL DEFAULT '#e0459b',
  font_family text NOT NULL DEFAULT 'Inter',
  border_radius integer NOT NULL DEFAULT 12,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_configs ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth yet)
CREATE POLICY "Anyone can view brand configs" ON public.brand_configs FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create brand configs" ON public.brand_configs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update brand configs" ON public.brand_configs FOR UPDATE TO public USING (true);

-- Updated_at trigger
CREATE TRIGGER update_brand_configs_updated_at
  BEFORE UPDATE ON public.brand_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for brand logos
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true);

-- Storage RLS policies
CREATE POLICY "Anyone can upload brand assets" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'brand-assets');
CREATE POLICY "Anyone can view brand assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'brand-assets');
