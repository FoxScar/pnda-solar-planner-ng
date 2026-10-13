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
  <Card className="w-full max-w-6xl mx-auto mt-8">
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Admin Panel
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:inline">{email}</span>
          <Button onClick={onSignOut} variant="outline" size="sm" className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <Tabs defaultValue="components" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="appliances">Appliances</TabsTrigger>
          <TabsTrigger value="sun-hours">Sun Hours</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
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
