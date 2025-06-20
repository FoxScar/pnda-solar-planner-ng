
-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Drop existing public read policies
DROP POLICY IF EXISTS "Allow public read access to appliances" ON public.appliances;
DROP POLICY IF EXISTS "Allow public read access to inverters" ON public.inverters;
DROP POLICY IF EXISTS "Allow public read access to batteries" ON public.batteries;
DROP POLICY IF EXISTS "Allow public read access to panels" ON public.panels;
DROP POLICY IF EXISTS "Allow public read access to sun_hours" ON public.sun_hours;

-- Create new RLS policies for appliances
CREATE POLICY "Admins can manage appliances"
ON public.appliances
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read appliances"
ON public.appliances
FOR SELECT
USING (true);

-- Create new RLS policies for inverters
CREATE POLICY "Admins can manage inverters"
ON public.inverters
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read inverters"
ON public.inverters
FOR SELECT
USING (true);

-- Create new RLS policies for batteries
CREATE POLICY "Admins can manage batteries"
ON public.batteries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read batteries"
ON public.batteries
FOR SELECT
USING (true);

-- Create new RLS policies for panels
CREATE POLICY "Admins can manage panels"
ON public.panels
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read panels"
ON public.panels
FOR SELECT
USING (true);

-- Create new RLS policies for sun_hours
CREATE POLICY "Admins can manage sun_hours"
ON public.sun_hours
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read sun_hours"
ON public.sun_hours
FOR SELECT
USING (true);

-- RLS policy for user_roles (users can only see their own roles)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all user roles
CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert a default admin user (you'll need to update this with your actual user ID after signup)
-- This is commented out - you'll need to manually add admin role to your user after testing
-- INSERT INTO public.user_roles (user_id, role) VALUES ('your-user-id-here', 'admin');
