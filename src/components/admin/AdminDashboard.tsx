
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, LogOut } from "lucide-react";
import { User } from '@supabase/supabase-js';
import ApplianceManager from "./ApplianceManager";
import InverterManager from "./InverterManager";
import BatteryManager from "./BatteryManager";
import PanelManager from "./PanelManager";

interface AdminDashboardProps {
  currentUser: User;
  onSignOut: () => void;
}

const AdminDashboard = ({ currentUser, onSignOut }: AdminDashboardProps) => {
  return (
    <Card className="w-full max-w-6xl mx-auto mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Admin Panel
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
};

export default AdminDashboard;
