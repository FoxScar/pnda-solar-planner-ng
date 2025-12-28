
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateSolarSystem } from "@/components/utils/solarCalculations";

const ApplianceSelection = ({ onNext, onBack, data }) => {
  const [appliances, setAppliances] = useState(data?.appliances || []);
  const [availableAppliances, setAvailableAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAppliances();
  }, []);

  const fetchAppliances = async () => {
    try {
      console.log('Fetching appliances...');
      const { data: appliancesData, error } = await supabase
        .from('appliances')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching appliances:', error);
        toast({
          title: "Error",
          description: "Failed to load appliances. Please try again.",
          variant: "destructive"
        });
        return;
      }

      console.log('Fetched appliances:', appliancesData);
      setAvailableAppliances(appliancesData || []);
      
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
      name: '',
      power_rating: 0,
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
      
      // Validate day + night hours don't exceed 24
      if (field === 'dayHours' || field === 'nightHours') {
        const totalHours = (field === 'dayHours' ? value : updated.dayHours) + 
                          (field === 'nightHours' ? value : updated.nightHours);
        if (totalHours > 24) {
          toast({
            title: "Invalid hours",
            description: "Day + Night hours cannot exceed 24 hours.",
            variant: "destructive"
          });
          return app; // Don't update
        }
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
      // Store power_rating internally but never display it
      setAppliances(appliances.map(app => 
        app.id === id ? { 
          ...app, 
          name: selectedAppliance.name,
          power_rating: selectedAppliance.power_rating // Internal use only
        } : app
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
      !app.name || app.quantity <= 0 || (app.dayHours === 0 && app.nightHours === 0)
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

    // Prepare appliances for calculation (power_w is internal, never shown to user)
    const appliancesForNext = appliances.map(app => ({
      id: app.id,
      name: app.name,
      power_w: app.power_rating || 0, // Internal power value
      quantity: app.quantity,
      day_hours: app.dayHours,
      night_hours: app.nightHours
    }));

    // Use the comprehensive calculation system
    const systemCalc = calculateSolarSystem(appliances.map(app => ({
      ...app,
      power: app.power_rating || 0
    })));

    // Extract key values for next steps (all internal, never shown)
    const daytimeLoad = systemCalc.totalLoadW; // Peak instantaneous load
    const nightEnergy = systemCalc.nightLoadWh / 1000; // Convert to kWh
    const dayEnergy = systemCalc.dayLoadWh / 1000; // Convert to kWh
    
    if (typeof onNext === 'function') {
      onNext({
        appliances: appliancesForNext,
        daytimeLoad, // Internal: for inverter sizing
        nightEnergy, // Internal: for battery sizing
        dayEnergy,   // Internal: for panel sizing
        systemCalculation: systemCalc
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
    app.name && app.quantity > 0 && (app.dayHours > 0 || app.nightHours > 0)
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
    <TooltipProvider>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Select Your Appliances
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Choose all the appliances you want to power with your solar system</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {appliances.map((appliance, index) => (
            <Card key={appliance.id} className="p-4 bg-gray-50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Appliance {index + 1}</Label>
                  {appliances.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAppliance(appliance.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`appliance-${appliance.id}`}>Device</Label>
                    <Select 
                      value={appliance.name || ""}
                      onValueChange={(value) => handleApplianceSelect(appliance.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose appliance" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                        {availableAppliances.map((item) => (
                          <SelectItem key={item.id} value={item.name}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`quantity-${appliance.id}`}>Quantity</Label>
                    <Input
                      id={`quantity-${appliance.id}`}
                      type="number"
                      min="1"
                      value={appliance.quantity}
                      onChange={(e) => updateAppliance(appliance.id, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`dayHours-${appliance.id}`} className="flex items-center gap-1">
                      Day Hours (7am-6pm)
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Hours this appliance runs during daytime (7am-6pm)</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id={`dayHours-${appliance.id}`}
                      type="number"
                      min="0"
                      max="11"
                      step="0.5"
                      value={appliance.dayHours || 0}
                      onChange={(e) => updateAppliance(appliance.id, 'dayHours', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`nightHours-${appliance.id}`} className="flex items-center gap-1">
                      Night Hours (6pm-7am)
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Hours this appliance runs during nighttime (6pm-7am)</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id={`nightHours-${appliance.id}`}
                      type="number"
                      min="0"
                      max="13"
                      step="0.5"
                      value={appliance.nightHours || 0}
                      onChange={(e) => updateAppliance(appliance.id, 'nightHours', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Validation feedback for hours */}
                {(appliance.dayHours + appliance.nightHours) > 20 && (
                  <div className="bg-amber-50 p-3 rounded-md">
                    <p className="text-sm text-amber-700">
                      ⚠️ Total usage: {appliance.dayHours + appliance.nightHours} hours/day
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={addAppliance}
            className="w-full border-dashed border-2 border-gray-300 py-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Appliance
          </Button>

          <div className="flex gap-4 pt-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button 
              onClick={handleNext} 
              disabled={!isValid}
              className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
            >
              Next: Choose Inverter
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default ApplianceSelection;
