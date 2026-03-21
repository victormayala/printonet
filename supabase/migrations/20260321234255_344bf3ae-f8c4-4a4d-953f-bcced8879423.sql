
-- 1. Create design_templates table
CREATE TABLE public.design_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  thumbnail_url text,
  canvas_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;

-- RLS: owners can CRUD their own templates
CREATE POLICY "Users can view own templates"
  ON public.design_templates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own templates"
  ON public.design_templates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates"
  ON public.design_templates FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON public.design_templates FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS: anyone can view public templates
CREATE POLICY "Anyone can view public templates"
  ON public.design_templates FOR SELECT TO anon
  USING (is_public = true);

-- updated_at trigger
CREATE TRIGGER update_design_templates_updated_at
  BEFORE UPDATE ON public.design_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create template-thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('template-thumbnails', 'template-thumbnails', true);

-- Storage RLS for template-thumbnails
CREATE POLICY "Anyone can view template thumbnails"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'template-thumbnails');

CREATE POLICY "Authenticated users can upload template thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'template-thumbnails');

CREATE POLICY "Authenticated users can update template thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'template-thumbnails');

CREATE POLICY "Authenticated users can delete template thumbnails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'template-thumbnails');

-- 3. Add customer columns to customizer_sessions
ALTER TABLE public.customizer_sessions
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS order_notes text;

-- 4. Add RLS policy for authenticated users to view their own sessions
CREATE POLICY "Authenticated users can view own sessions"
  ON public.customizer_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
