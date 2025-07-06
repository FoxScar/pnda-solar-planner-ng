
-- Remove the dangerous RLS policy that allows self-admin assignment
DROP POLICY IF EXISTS "Users can assign themselves admin role initially" ON public.user_roles;

-- Create audit table for tracking admin role changes
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  role_assigned TEXT NOT NULL,
  assigned_by UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create secure admin bootstrap function
CREATE OR REPLACE FUNCTION public.bootstrap_initial_admin(
  target_user_id UUID,
  bootstrap_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_count INTEGER;
  result JSON;
BEGIN
  -- Check if any admins already exist
  SELECT COUNT(*) INTO admin_count 
  FROM public.user_roles 
  WHERE role = 'admin';
  
  -- If admins already exist, reject the request
  IF admin_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin users already exist. Cannot bootstrap new admin.',
      'admin_count', admin_count
    );
  END IF;
  
  -- Verify the user exists in auth.users (this will fail if user doesn't exist)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Target user does not exist'
    );
  END IF;
  
  -- Create the admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin');
  
  -- Log the bootstrap action
  INSERT INTO public.admin_audit_log (
    user_id, 
    action, 
    role_assigned, 
    assigned_by
  ) VALUES (
    target_user_id,
    'BOOTSTRAP_ADMIN',
    'admin',
    target_user_id
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Admin role successfully assigned',
    'user_id', target_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create admin: ' || SQLERRM
    );
END;
$$;

-- Create function to safely assign admin roles (only by existing admins)
CREATE OR REPLACE FUNCTION public.assign_admin_role(
  target_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  -- Verify the requesting user is an admin
  IF NOT public.has_role(requesting_user_id, 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only existing admins can assign admin roles'
    );
  END IF;
  
  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Target user does not exist'
    );
  END IF;
  
  -- Check if user already has admin role
  IF public.has_role(target_user_id, 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User already has admin role'
    );
  END IF;
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin');
  
  -- Log the action
  INSERT INTO public.admin_audit_log (
    user_id, 
    action, 
    role_assigned, 
    assigned_by
  ) VALUES (
    target_user_id,
    'ADMIN_ASSIGNED',
    'admin',
    requesting_user_id
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Admin role successfully assigned',
    'assigned_to', target_user_id,
    'assigned_by', requesting_user_id
  );
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User already has this role'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to assign admin role: ' || SQLERRM
    );
END;
$$;

-- Create function to check if system needs initial admin
CREATE OR REPLACE FUNCTION public.needs_initial_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  );
$$;
