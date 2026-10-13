
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import AppliancePicker, { type CatalogueAppliance } from "./wizard/AppliancePicker";
import Stepper from "./wizard/Stepper";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ApplianceSelection = ({ onNext, onBack, data }) => {
  // Start with one empty card so the first action is choosing a device, not finding the Add button.
  const [appliances, setAppliances] = useState(() =>
    data?.appliances?.length ? data.appliances : [{ id: Date.now(), applianceId: null, name: '', quantity: 1, dayHours: 0, nightHours: 0 }]
  );
  const [availableAppliances, setAvailableAppliances] = useState<CatalogueAppliance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Day/night windows come from the engine settings (default night 17:00–06:00).
  const [windows, setWindows] = useState({ nightStart: '17:00', nightEnd: '06:00', dayHours: 11, nightHours: 13 });
  useEffect(() => {
    api<typeof windows>('/config').then(setWindows).catch(() => {});
  }, []);
  const fmtTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const dayLabel = `${fmtTime(windows.nightEnd)}–${fmtTime(windows.nightStart)}`;
  const nightLabel = `${fmtTime(windows.nightStart)}–${fmtTime(windows.nightEnd)}`;

  useEffect(() => {
    fetchAppliances();
  }, []);

  const fetchAppliances = async () => {
    try {
      // Wattage and surge data stay on the server (FR-003); we only get names.
      const appliancesData = await api<CatalogueAppliance[]>('/appliances');
      setAvailableAppliances(appliancesData);
      
      if (!appliancesData || appliancesData.length === 0) {
        toast({
          title: "No appliances found",
          description: "No appliances are available in the database.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to load appliances. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addAppliance = () => {
    const newAppliance = {
      id: Date.now(),
      applianceId: null,
      name: '',
      quantity: 1,
      dayHours: 0,
      nightHours: 0
    };
    console.log('Adding new appliance:', newAppliance);
    setAppliances([...appliances, newAppliance]);
  };

  const updateAppliance = (id, field, value) => {
    setAppliances(appliances.map(app => {
      if (app.id !== id) return app;
      
      const updated = { ...app, [field]: value };
      
      // Runtime must fit inside its window (schematics §1); the server enforces the same limits.
      const limit = field === 'dayHours' ? windows.dayHours : field === 'nightHours' ? windows.nightHours : null;
      if (limit !== null && value > limit) {
        toast({
          title: "Invalid hours",
          description: field === 'dayHours'
            ? `Daytime (${dayLabel}) is ${limit} hours long.`
            : `Night-time (${nightLabel}) is ${limit} hours long.`,
          variant: "destructive"
        });
        return app; // Don't update
      }
      
      // Validate quantity is at least 1
      if (field === 'quantity' && value < 1) {
        return { ...app, quantity: 1 };
      }
      
      return updated;
    }));
  };

  const removeAppliance = (id) => {
    setAppliances(appliances.filter(app => app.id !== id));
  };

  const handleApplianceSelect = (id, selectedName) => {
    const selectedAppliance = availableAppliances.find(app => app.name === selectedName);
    
    if (selectedAppliance) {
      setAppliances(appliances.map(app => 
        app.id === id ? { ...app, applianceId: selectedAppliance.id, name: selectedAppliance.name, category: selectedAppliance.category } : app
      ));
    } else {
      toast({
        title: "Selection Error",
        description: "The selected appliance could not be found.",
        variant: "destructive"
      });
    }
  };

  const handleNext = () => {
    console.log('Next button clicked');
    console.log('Current appliances:', appliances);
    
    if (appliances.length === 0) {
      toast({
        title: "No appliances selected",
        description: "Please add at least one appliance to continue.",
        variant: "destructive"
      });
      return;
    }

    const invalidAppliances = appliances.filter(app => 
      !app.applianceId || app.quantity <= 0 || (app.dayHours === 0 && app.nightHours === 0)
    );
    if (invalidAppliances.length > 0) {
      console.log('Invalid appliances found:', invalidAppliances);
      toast({
        title: "Invalid appliances",
        description: "Please ensure all appliances have a name, quantity greater than 0, and at least some usage hours.",
        variant: "destructive"
      });
      return;
    }

    // Only catalogue ids, quantities and hours leave the browser; sizing happens server-side.
    const appliancesForNext = appliances.map(app => ({
      id: app.id,
      applianceId: app.applianceId,
      name: app.name,
      category: app.category,
      quantity: app.quantity,
      dayHours: app.dayHours,
      nightHours: app.nightHours
    }));

    if (typeof onNext === 'function') {
      onNext({
        appliances: appliancesForNext
      });
    } else {
      toast({
        title: "Navigation Error",
        description: "Unable to proceed to next step. Please try again.",
        variant: "destructive"
      });
    }
  };

  const isValid = appliances.length > 0 && appliances.every(app => 
    app.applianceId && app.quantity > 0 && (app.dayHours > 0 || app.nightHours > 0)
  );

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p>Loading appliances...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (availableAppliances.length === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No appliances available in the database.</p>
            <Button onClick={fetchAppliances} variant="outline">
              Retry Loading
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-xl sm:text-2xl">Select Your Appliances</CardTitle>
        <p className="text-sm text-gray-600">
          Add everything you want to power, and how many hours each one actually runs in the day ({dayLabel}) and at night ({nightLabel}).
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {appliances.map((appliance, index) => (
          <div key={appliance.id} className="rounded-lg border bg-gray-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Appliance {index + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeAppliance(appliance.id)}
                className="h-11 w-11 text-red-500 hover:text-red-700"
                aria-label={`Remove appliance ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label htmlFor={`appliance-${appliance.id}`} className="text-sm font-medium leading-none">Device</label>
              <AppliancePicker
                id={`appliance-${appliance.id}`}
                appliances={availableAppliances}
                value={appliance.applianceId}
                onSelect={(a) => handleApplianceSelect(appliance.id, a.name)}
              />
            </div>

            <Stepper
              id={`quantity-${appliance.id}`}
              label="Quantity"
              value={appliance.quantity}
              min={1}
              max={100}
              step={1}
              onChange={(v) => updateAppliance(appliance.id, 'quantity', v)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Stepper
                id={`dayHours-${appliance.id}`}
                label="Daytime use"
                hint={`${dayLabel}, up to ${windows.dayHours}h`}
                value={appliance.dayHours}
                min={0}
                max={windows.dayHours}
                step={0.5}
                unit="hrs"
                slider
                onChange={(v) => updateAppliance(appliance.id, 'dayHours', v)}
              />
              <Stepper
                id={`nightHours-${appliance.id}`}
                label="Night-time use"
                hint={`${nightLabel}, up to ${windows.nightHours}h`}
                value={appliance.nightHours}
                min={0}
                max={windows.nightHours}
                step={0.5}
                unit="hrs"
                slider
                onChange={(v) => updateAppliance(appliance.id, 'nightHours', v)}
              />
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addAppliance}
          className="w-full border-dashed border-2 border-gray-300 min-h-14"
        >
          <Plus className="w-4 h-4 mr-2" />
          {appliances.length === 0 ? 'Add an Appliance' : 'Add Another Appliance'}
        </Button>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack} className="flex-1 min-h-12">
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!isValid}
            className="flex-[2] min-h-12 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
          >
            Next: Your Location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApplianceSelection;
