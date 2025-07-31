
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminRPCResponse } from './types';

export const useAdminAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<Array<{ role: string }>>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Debug logging
  const logDebug = (message: string, data?: any) => {
    console.log(`[AdminAuth] ${message}`, data || '');
  };

  useEffect(() => {
    logDebug('Initializing admin auth');
    checkCurrentUser();
    checkInitialAdminStatus();
    
    // Listen for auth changes with enhanced logging
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logDebug('Auth state change', { event, userId: session?.user?.id });
      
      if (session?.user) {
        setCurrentUser(session.user);
        // Use setTimeout to prevent potential deadlock
        setTimeout(() => {
          checkUserRoles(session.user.id);
        }, 0);
      } else {
        setCurrentUser(null);
        setUserRoles([]);
        setIsAdmin(false);
        logDebug('User signed out, cleared admin state');
      }
    });

    return () => {
      logDebug('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const checkCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUser(session.user);
      await checkUserRoles(session.user.id);
    }
  };

  const checkInitialAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('needs_initial_admin');
      if (error) {
        console.error('Error checking admin status:', error);
      } else {
        setNeedsInitialAdmin(data);
      }
    } catch (error) {
      console.error('Error checking initial admin status:', error);
    }
  };

  const checkUserRoles = async (userId: string) => {
    try {
      logDebug('Checking user roles', { userId });
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) {
        logDebug('Error fetching user roles', error);
        throw error;
      }
      
      setUserRoles(roles || []);
      const adminStatus = roles?.some(r => r.role === 'admin') || false;
      setIsAdmin(adminStatus);
      logDebug('Updated roles', { roles, isAdmin: adminStatus });
    } catch (error) {
      logDebug('Failed to check user roles', error);
      toast({
        title: "Warning",
        description: "Failed to check user permissions",
        variant: "destructive"
      });
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Signed out successfully",
      });
    }
  };

  const bootstrapInitialAdmin = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('bootstrap_initial_admin', {
        target_user_id: currentUser.id
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // Properly handle the RPC response with type safety
        if (typeof data === 'object' && data !== null) {
          const result = data as AdminRPCResponse;
          if (result.success) {
            toast({
              title: "Success",
              description: result.message || "Admin role successfully assigned",
            });
            await checkUserRoles(currentUser.id);
            await checkInitialAdminStatus();
          } else {
            toast({
              title: "Error",
              description: result.error || "Failed to bootstrap admin role",
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "Error",
            description: "Unexpected response format",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to bootstrap admin role",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleAuthSuccess = () => {
    logDebug('Auth success, refreshing status');
    checkInitialAdminStatus();
  };

  const refreshAdminData = async () => {
    if (!currentUser) return;
    
    setRefreshing(true);
    logDebug('Manually refreshing admin data');
    
    try {
      await Promise.all([
        checkUserRoles(currentUser.id),
        checkInitialAdminStatus()
      ]);
      
      toast({
        title: "Success",
        description: "Admin data refreshed successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh admin data",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  return {
    currentUser,
    userRoles,
    isAdmin,
    needsInitialAdmin,
    loading,
    refreshing,
    handleSignOut,
    bootstrapInitialAdmin,
    handleAuthSuccess,
    refreshAdminData
  };
};
