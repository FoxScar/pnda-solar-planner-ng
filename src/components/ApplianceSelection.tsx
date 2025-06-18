
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Plus, Trash2 } from "lucide-react";

const ApplianceSelection = ({ onNext, onBack, data }) => {
  const [appliances, setAppliances] = useState(data?.appliances || []);

  const nigerianAppliances = [
    { name: 'LED Bulb (9W)', power: 9 },
    { name: 'LED Bulb (15W)', power: 15 },
    { name: 'Fluorescent Light (18W)', power: 18 },
    { name: 'Fluorescent Light (36W)', power: 36 },
    { name: 'Standing Fan', power: 75 },
    { name: 'Ceiling Fan', power: 60 },
    { name: 'Table Fan', power: 45 },
    { name: 'TV (32" LED)', power: 65 },
    { name: 'TV (43" LED)', power: 85 },
    { name: 'TV (55" LED)', power: 120 },
    { name: 'Sound System', power: 150 },
    { name: 'Decoder (DStv/GOtv)', power: 25 },
    { name: 'Laptop', power: 65 },
    { name: 'Phone Charger', power: 15 },
    { name: 'Small Fridge (120L)', power: 150 },
    { name: 'Medium Fridge (200L)', power: 200 },
    { name: 'Large Fridge (300L)', power: 280 },
    { name: 'Freezer (200L)', power: 180 },
    { name: 'Washing Machine', power: 500 },
    { name: 'Blender', power: 350 },
    { name: 'Iron', power: 1000 },
    { name: 'Microwave', power: 800 },
    { name: 'Water Pump (0.5HP)', power: 370 },
    { name: 'Water Pump (1HP)', power: 750 },
    { name: 'AC Unit (1HP)', power: 750 },
    { name: 'AC Unit (1.5HP)', power: 1100 },
    { name: 'AC Unit (2HP)', power: 1500 }
  ];

  const addAppliance = () => {
    setAppliances([...appliances, {
      id: Date.now(),
      name: '',
      power: 0,
      quantity: 1,
      hoursPerDay: 4,
      period: 'both',
      isPeakUsage: false
    }]);
  };

  const updateAppliance = (id, field, value) => {
    setAppliances(appliances.map(app => 
      app.id === id ? { ...app, [field]: value } : app
    ));
  };

  const removeAppliance = (id) => {
    setAppliances(appliances.filter(app => app.id !== id));
  };

  const handleApplianceSelect = (id, selectedName) => {
    const selectedAppliance = nigerianAppliances.find(app => app.name === selectedName);
    if (selectedAppliance) {
      updateAppliance(id, 'name', selectedAppliance.name);
      updateAppliance(id, 'power', selectedAppliance.power);
    }
  };

  const handleNext = () => {
    if (appliances.length > 0 && appliances.every(app => app.name && app.quantity > 0)) {
      onNext(appliances);
    }
  };

  const isValid = appliances.length > 0 && appliances.every(app => app.name && app.quantity > 0);

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
                  {appliances.length > 1 && (
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
                    <Select onValueChange={(value) => handleApplianceSelect(appliance.id, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose appliance" />
                      </SelectTrigger>
                      <SelectContent>
                        {nigerianAppliances.map((item) => (
                          <SelectItem key={item.name} value={item.name}>
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
                    <Select onValueChange={(value) => updateAppliance(appliance.id, 'period', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day only</SelectItem>
                        <SelectItem value="night">Night only</SelectItem>
                        <SelectItem value="both">Day & Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`peak-${appliance.id}`}
                    checked={appliance.isPeakUsage}
                    onCheckedChange={(checked) => updateAppliance(appliance.id, 'isPeakUsage', checked)}
                  />
                  <Label htmlFor={`peak-${appliance.id}`} className="text-sm flex items-center gap-1">
                    Might run during peak usage
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-3 h-3 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Check if this appliance might run when many others are also running</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>
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
