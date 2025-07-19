
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
      hoursPerDay: 4,
      period: 'both'
    };
    console.log('Adding new appliance:', newAppliance);
    setAppliances([...appliances, newAppliance]);
  };

  const updateAppliance = (id, field, value) => {
    console.log(`Updating appliance ${id}: ${field} = ${value}`);
    setAppliances(appliances.map(app => 
      app.id === id ? { ...app, [field]: value } : app
    ));
  };

  const removeAppliance = (id) => {
    console.log('Removing appliance:', id);
    setAppliances(appliances.filter(app => app.id !== id));
  };

  const handleApplianceSelect = (id, selectedName) => {
    console.log(`Selecting appliance for ${id}: ${selectedName}`);
    
    const selectedAppliance = availableAppliances.find(app => app.name === selectedName);
    console.log('Found appliance:', selectedAppliance);
    
    if (selectedAppliance) {
      setAppliances(appliances.map(app => 
        app.id === id ? { 
          ...app, 
          name: selectedAppliance.name,
          power_rating: selectedAppliance.power_rating 
        } : app
      ));
      
      console.log(`Updated appliance ${id} with name: ${selectedAppliance.name}, power: ${selectedAppliance.power_rating}`);
    } else {
      console.error('Selected appliance not found:', selectedName);
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

    const invalidAppliances = appliances.filter(app => !app.name || app.quantity <= 0);
    if (invalidAppliances.length > 0) {
      console.log('Invalid appliances found:', invalidAppliances);
      toast({
        title: "Invalid appliances",
        description: "Please ensure all appliances have a name and quantity greater than 0.",
        variant: "destructive"
      });
      return;
    }

    // Calculate loads properly for new system
    const appliancesForNext = appliances.map(app => ({
      ...app,
      power: app.power_rating || app.power || 0
    }));

    // Calculate totals for transparent display
    const daytimeLoad = appliancesForNext
      .filter(app => app.period === 'day' || app.period === 'both')
      .reduce((total, app) => total + (app.power * app.quantity), 0);
    
    const nighttimeLoad = appliancesForNext
      .filter(app => app.period === 'night' || app.period === 'both')
      .reduce((total, app) => total + (app.power * app.quantity), 0);

    const nightEnergy = appliancesForNext
      .filter(app => app.period === 'night' || app.period === 'both')
      .reduce((total, app) => {
        const nightHours = app.period === 'both' ? app.hoursPerDay / 2 : app.hoursPerDay;
        return total + (app.power * app.quantity * nightHours);
      }, 0) / 1000; // Convert to kWh

    console.log('Calculated loads:', { daytimeLoad, nighttimeLoad, nightEnergy });
    
    if (typeof onNext === 'function') {
      onNext({
        appliances: appliancesForNext,
        daytimeLoad,
        nighttimeLoad,
        nightEnergy
      });
    } else {
      console.error('onNext is not a function:', onNext);
      toast({
        title: "Navigation Error",
        description: "Unable to proceed to next step. Please try again.",
        variant: "destructive"
      });
    }
  };

  const isValid = appliances.length > 0 && appliances.every(app => app.name && app.quantity > 0);

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
                    <Label htmlFor={`hours-${appliance.id}`} className="flex items-center gap-1">
                      Hours per day
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>How many hours per day do you use this appliance?</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id={`hours-${appliance.id}`}
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={appliance.hoursPerDay}
                      onChange={(e) => updateAppliance(appliance.id, 'hoursPerDay', parseFloat(e.target.value) || 1)}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`period-${appliance.id}`} className="flex items-center gap-1">
                      Usage time
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>When do you mostly use this appliance?</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Select 
                      value={appliance.period}
                      onValueChange={(value) => updateAppliance(appliance.id, 'period', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                        <SelectItem value="day">Day only</SelectItem>
                        <SelectItem value="night">Night only</SelectItem>
                        <SelectItem value="both">Day & Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {appliance.name && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-700">
                      Selected: {appliance.name}
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
