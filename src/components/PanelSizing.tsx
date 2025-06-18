
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, PanelsTopLeft, Sun } from "lucide-react";

const PanelSizing = ({ onNext, onBack, data }) => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedPanel, setSelectedPanel] = useState(data?.panels || null);

  const nigerianStates = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara'
  ];

  // Mock panel data - would be calculated based on location and needs
  const panels = [
    {
      id: 1,
      model: 'Monocrystalline 400W',
      quantity: 6,
      totalWatts: 2400,
      cost: 360000,
      recommended: true,
      description: 'High efficiency panels, perfect for Nigerian climate',
      efficiency: '21%'
    },
    {
      id: 2,
      model: 'Polycrystalline 350W',
      quantity: 7,
      totalWatts: 2450,
      cost: 315000,
      recommended: false,
      description: 'Good value option with reliable performance',
      efficiency: '18%'
    },
    {
      id: 3,
      model: 'Monocrystalline 450W',
      quantity: 6,
      totalWatts: 2700,
      cost: 405000,
      recommended: false,
      description: 'Premium high-power panels for maximum output',
      efficiency: '22%'
    }
  ];

  const handleNext = () => {
    if (selectedState && selectedPanel) {
      onNext({ state: selectedState, panels: selectedPanel });
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getSunHours = (state) => {
    // Simplified mapping - real app would have detailed data
    const sunHours = {
      'Lagos': 4.5, 'Kano': 5.8, 'Kaduna': 5.5, 'FCT': 5.2, 'Rivers': 4.2,
      'Ogun': 4.8, 'Plateau': 5.5, 'Katsina': 6.0, 'Bauchi': 5.7
    };
    return sunHours[state] || 5.0;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PanelsTopLeft className="w-5 h-5 text-yellow-500" />
          Choose Your Solar Panels
        </CardTitle>
        <p className="text-gray-600">First, tell us your location to optimize panel recommendations:</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="state">Your State</Label>
          <Select onValueChange={setSelectedState}>
            <SelectTrigger>
              <SelectValue placeholder="Select your state" />
            </SelectTrigger>
            <SelectContent>
              {nigerianStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedState && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <Sun className="w-4 h-4" />
                <span>
                  <strong>{selectedState}</strong> gets approximately{' '}
                  <strong>{getSunHours(selectedState)} hours</strong> of peak sun daily
                </span>
              </div>
            </div>
          )}
        </div>

        {selectedState && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Recommended Panel Options:</h3>
            
            <div className="grid gap-4">
              {panels.map((panel) => (
                <Card 
                  key={panel.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedPanel?.id === panel.id 
                      ? 'ring-2 ring-yellow-500 bg-yellow-50' 
                      : 'hover:shadow-md'
                  } ${
                    panel.recommended 
                      ? 'border-green-200 bg-green-50/50' 
                      : ''
                  }`}
                  onClick={() => setSelectedPanel(panel)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{panel.model}</h3>
                        {panel.recommended && (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            Recommended
                          </Badge>
                        )}
                        {selectedPanel?.id === panel.id && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {formatPrice(panel.cost)}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3">{panel.description}</p>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium block">Quantity:</span>
                        <span className="text-gray-600">{panel.quantity} panels</span>
                      </div>
                      <div>
                        <span className="font-medium block">Total Power:</span>
                        <span className="text-gray-600">{panel.totalWatts}W</span>
                      </div>
                      <div>
                        <span className="font-medium block">Efficiency:</span>
                        <span className="text-gray-600">{panel.efficiency}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedPanel && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-green-900 mb-2">Your Solar Generation</h4>
              <p className="text-green-800 text-sm">
                With {selectedPanel.quantity} × {selectedPanel.model} panels in {selectedState}, 
                you'll generate approximately{' '}
                <strong>
                  {Math.round(selectedPanel.totalWatts * getSunHours(selectedState) / 1000)} kWh
                </strong>{' '}
                of clean energy daily - enough to power your selected appliances and charge your batteries!
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back to Battery
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!selectedState || !selectedPanel}
            className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
          >
            Review Your System
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PanelSizing;
