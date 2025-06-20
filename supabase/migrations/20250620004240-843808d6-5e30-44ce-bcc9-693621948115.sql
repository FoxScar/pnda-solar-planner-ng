
-- Add a new RLS policy that allows users to assign themselves admin role initially
CREATE POLICY "Users can assign themselves admin role initially"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND 
  role = 'admin' AND
  NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);
