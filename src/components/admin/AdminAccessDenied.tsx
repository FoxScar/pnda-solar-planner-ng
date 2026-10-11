import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX, LogOut } from "lucide-react";
import type { Role } from "../../../shared/domain";

interface AdminAccessDeniedProps {
  email: string;
  role: Role;
  onSignOut: () => void;
}

const AdminAccessDenied = ({ email, role, onSignOut }: AdminAccessDeniedProps) => (
  <Card className="w-full max-w-md mx-auto">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ShieldX className="w-5 h-5 text-red-500" />
        Admin Access Required
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-gray-700">
        You're signed in as <strong>{email}</strong> with the <strong>{role}</strong> role.
        Ask an existing administrator to grant you admin access.
      </p>
      <Button variant="outline" onClick={onSignOut} className="w-full flex items-center gap-2">
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </CardContent>
  </Card>
);

export default AdminAccessDenied;
