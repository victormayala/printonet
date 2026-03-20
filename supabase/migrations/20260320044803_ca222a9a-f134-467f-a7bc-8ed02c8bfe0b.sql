
-- Create customizer_sessions table
CREATE TABLE public.customizer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_data jsonb NOT NULL,
  design_output jsonb,
  status text NOT NULL DEFAULT 'active',
  external_ref text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customizer_sessions ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (sessions are ephemeral, identified by UUID)
CREATE POLICY "Anyone can create sessions" ON public.customizer_sessions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can view sessions" ON public.customizer_sessions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update sessions" ON public.customizer_sessions FOR UPDATE TO public USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_customizer_sessions_updated_at
  BEFORE UPDATE ON public.customizer_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create design-exports storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('design-exports', 'design-exports', true);

-- Storage policies for design-exports bucket
CREATE POLICY "Anyone can upload design exports" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'design-exports');
CREATE POLICY "Anyone can view design exports" ON storage.objects FOR SELECT TO public USING (bucket_id = 'design-exports');
