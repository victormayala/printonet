CREATE POLICY "Super admins can delete all corporate stores"
ON public.corporate_stores
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));