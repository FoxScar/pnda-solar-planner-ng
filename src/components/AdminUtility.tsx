
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminUtility = () => {
  const [userEmail, setUserEmail] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      
      // Check if current user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      setUserRoles(roles || []);
      setIsAdmin(roles?.some(r => r.role === 'admin') || false);
    }
  };

  const makeUserAdmin = async () => {
    if (!userEmail) {
      toast({
        title: "Error",
        description: "Please enter a user email",
        variant: "destructive"
      });
      return;
    }

    // For demo purposes, we'll use the current user's ID
    // In a real application, you'd need to look up the user by email
    if (currentUser) {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: currentUser.id,
          role: 'admin'
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Info",
            description: "User is already an admin",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Admin role assigned successfully",
        });
        checkCurrentUser(); // Refresh roles
      }
    }
  };

  const makeCurrentUserAdmin = async () => {
    if (currentUser) {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: currentUser.id,
          role: 'admin'
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Info",
            description: "You are already an admin",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Success",
          description: "You are now an admin!",
        });
        checkCurrentUser();
      }
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Admin Utility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentUser ? (
          <div className="space-y-4">
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

            {!isAdmin && (
              <div className="space-y-3">
                <h3 className="font-medium">Make Yourself Admin</h3>
                <p className="text-sm text-gray-600">
                  Click the button below to assign admin role to your current account:
                </p>
                <Button onClick={makeCurrentUserAdmin} className="w-full">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Make Me Admin
                </Button>
              </div>
            )}

            {isAdmin && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <Shield className="w-4 h-4" />
                  <span className="font-medium">You have admin privileges</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  You can now manage appliances, inverters, batteries, panels, and user roles.
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Admin Instructions</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• Admins can perform CRUD operations on all component tables</p>
                <p>• Public users can still read data for the calculator functionality</p>
                <p>• To assign admin roles to other users, you'll need their user ID from the auth.users table</p>
                <p>• Use the Supabase dashboard to manage roles for other users</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Please sign in to use admin utilities</p>
            <Button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
              Sign In
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminUtility;
