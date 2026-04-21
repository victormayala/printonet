CREATE POLICY "Users can delete own corporate stores"
ON public.corporate_stores
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);