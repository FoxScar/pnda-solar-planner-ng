import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, UserPlus, LogOut, Mail, Lock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ApplianceManager from "./admin/ApplianceManager";
import InverterManager from "./admin/InverterManager";
import BatteryManager from "./admin/BatteryManager";
import PanelManager from "./admin/PanelManager";

// Type definitions for database function responses
interface BootstrapResponse {
  success: boolean;
  message?: string;
  error?: string;
  user_id?: string;
  admin_count?: number;
}

const AdminUtility = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const { toast } = useToast();

  useEffect(() => {
    checkCurrentUser();
    checkInitialAdminStatus();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        checkUserRoles(session.user.id);
      } else {
        setCurrentUser(null);
        setUserRoles([]);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
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

  const checkUserRoles = async (userId) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    setUserRoles(roles || []);
    setIsAdmin(roles?.some(r => r.role === 'admin') || false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`
      }
    });

    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Account created successfully! Please check your email for verification.",
      });
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      // Recheck admin status after signup
      checkInitialAdminStatus();
    }
    setLoading(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Signed in successfully!",
      });
      setEmail('');
      setPassword('');
    }
    setLoading(false);
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
        const response = data as BootstrapResponse;
        if (response.success) {
          toast({
            title: "Success",
            description: response.message,
          });
          await checkUserRoles(currentUser.id);
          await checkInitialAdminStatus();
        } else {
          toast({
            title: "Error",
            description: response.error,
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

  if (currentUser && isAdmin) {
    return (
      <Card className="w-full max-w-6xl mx-auto mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              Admin Panel
            </CardTitle>
            <Button 
              onClick={handleSignOut} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <Shield className="w-4 h-4" />
              <span className="font-medium">Logged in as: {currentUser.email}</span>
            </div>
          </div>

          <Tabs defaultValue="appliances" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="appliances">Appliances</TabsTrigger>
              <TabsTrigger value="inverters">Inverters</TabsTrigger>
              <TabsTrigger value="batteries">Batteries</TabsTrigger>
              <TabsTrigger value="panels">Panels</TabsTrigger>
            </TabsList>
            
            <TabsContent value="appliances" className="mt-6">
              <ApplianceManager />
            </TabsContent>
            
            <TabsContent value="inverters" className="mt-6">
              <InverterManager />
            </TabsContent>
            
            <TabsContent value="batteries" className="mt-6">
              <BatteryManager />
            </TabsContent>
            
            <TabsContent value="panels" className="mt-6">
              <PanelManager />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  if (currentUser && !isAdmin) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              Admin Utility
            </CardTitle>
            <Button 
              onClick={handleSignOut} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Current User</h3>
            <p className="text-sm text-gray-600 mb-2">Email: {currentUser.email}</p>
            <p className="text-sm text-gray-600 mb-2">ID: {currentUser.id}</p>
            <div className="flex gap-2">
              {userRoles.map((role, index) => (
                <Badge key={index} variant={role.role === 'admin' ? 'default' : 'secondary'}>
                  {role.role}
                </Badge>
              ))}
              {userRoles.length === 0 && (
                <Badge variant="outline">No roles assigned</Badge>
              )}
            </div>
          </div>

          {needsInitialAdmin && (
            <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="font-medium">Initial Admin Setup</h3>
              </div>
              <p className="text-sm text-yellow-700">
                No admin users exist in the system. You can bootstrap yourself as the initial admin.
              </p>
              <Button 
                onClick={bootstrapInitialAdmin} 
                className="w-full"
                disabled={loading}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {loading ? "Setting up..." : "Become Initial Admin"}
              </Button>
            </div>
          )}

          {!needsInitialAdmin && (
            <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <Shield className="w-4 h-4" />
                <h3 className="font-medium">Access Denied</h3>
              </div>
              <p className="text-sm text-red-700">
                You don't have admin privileges. Only existing admins can assign admin roles to other users.
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">Security Information</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Admin roles can only be assigned by existing admins</p>
              <p>• All admin actions are logged and audited</p>
              <p>• Contact an existing admin to request admin privileges</p>
              <p>• System prevents unauthorized privilege escalation</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-center justify-center">
          <Shield className="w-5 h-5 text-blue-500" />
          Admin Authentication
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4 mt-6">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="signin-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="signin-password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4 mt-6">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="signup-password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            Secure admin access with audit logging and role-based permissions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUtility;
