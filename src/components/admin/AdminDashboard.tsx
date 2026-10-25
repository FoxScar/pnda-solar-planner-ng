import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, LogOut } from "lucide-react";
import ApplianceManager from "./ApplianceManager";
import ComponentManager from "./ComponentManager";
import SunHoursManager from "./SunHoursManager";
import SettingsManager from "./SettingsManager";
import UserManager from "./UserManager";

interface AdminDashboardProps {
  email: string;
  onSignOut: () => void;
}

const AdminDashboard = ({ email, onSignOut }: AdminDashboardProps) => (
  <Card className="w-full max-w-6xl mx-auto">
    <CardHeader className="px-3 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base font-medium">
          <Shield className="w-5 h-5 shrink-0 text-blue-500" />
          <span className="truncate">{email}</span>
        </CardTitle>
        <Button onClick={onSignOut} variant="outline" className="h-11 shrink-0 px-3" aria-label="Sign out">
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </CardHeader>
    <CardContent className="px-3 sm:px-6">
      <Tabs defaultValue="components" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
          <TabsTrigger value="components" className="min-h-11">Components</TabsTrigger>
          <TabsTrigger value="appliances" className="min-h-11">Appliances</TabsTrigger>
          <TabsTrigger value="sun-hours" className="min-h-11">Sun Hours</TabsTrigger>
          <TabsTrigger value="settings" className="min-h-11">Settings</TabsTrigger>
          <TabsTrigger value="users" className="min-h-11">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="components" className="mt-6"><ComponentManager /></TabsContent>
        <TabsContent value="appliances" className="mt-6"><ApplianceManager /></TabsContent>
        <TabsContent value="sun-hours" className="mt-6"><SunHoursManager /></TabsContent>
        <TabsContent value="settings" className="mt-6"><SettingsManager /></TabsContent>
        <TabsContent value="users" className="mt-6"><UserManager /></TabsContent>
      </Tabs>
    </CardContent>
  </Card>
);

export default AdminDashboard;
