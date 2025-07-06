
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, LogOut, UserPlus, AlertTriangle } from "lucide-react";
import { User } from '@supabase/supabase-js';
import { AdminRPCResponse } from './types';

interface AdminAccessDeniedProps {
  currentUser: User;
  userRoles: Array<{ role: string }>;
  needsInitialAdmin: boolean;
  loading: boolean;
  onSignOut: () => void;
  onBootstrapAdmin: () => void;
}

const AdminAccessDenied = ({ 
  currentUser, 
  userRoles, 
  needsInitialAdmin, 
  loading, 
  onSignOut, 
  onBootstrapAdmin 
}: AdminAccessDeniedProps) => {
  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Admin Utility
          </CardTitle>
          <Button 
            onClick={onSignOut} 
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

        {needsInitialAdmin ? (
          <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="font-medium">Initial Admin Setup</h3>
            </div>
            <p className="text-sm text-yellow-700">
              No admin users exist in the system. You can bootstrap yourself as the initial admin.
            </p>
            <Button 
              onClick={onBootstrapAdmin} 
              className="w-full"
              disabled={loading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? "Setting up..." : "Become Initial Admin"}
            </Button>
          </div>
        ) : (
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
};

export default AdminAccessDenied;
