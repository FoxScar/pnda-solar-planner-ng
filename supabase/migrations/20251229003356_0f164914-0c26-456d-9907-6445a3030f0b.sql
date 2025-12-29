-- Drop existing SELECT policy and recreate with explicit authentication check
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;

-- Create new policy that explicitly requires authentication AND ownership
CREATE POLICY "Users can view their own profile" 
ON public.user_profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Update INSERT policy to also have explicit auth check
DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;

CREATE POLICY "Users can create their own profile" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Update UPDATE policy to also have explicit auth check  
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Users can update their own profile" 
ON public.user_profiles 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);