
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, PanelsTopLeft, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PanelSizing = ({ onNext, onBack, data }) => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedPanel, setSelectedPanel] = useState(data?.panels || null);
  const [panels, setPanels] = useState([]);
  const [sunHours, setSunHours] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [panelsResponse, sunHoursResponse] = await Promise.all([
        supabase.from('panels').select('*').eq('available', true).order('rated_power', { ascending: true }),
        supabase.from('sun_hours').select('*').order('state', { ascending: true })
      ]);

      if (panelsResponse.error || sunHoursResponse.error) {
        console.error('Error fetching data:', panelsResponse.error || sunHoursResponse.error);
        return;
      }

      // Calculate recommended panels based on energy needs
      const energyNeeds = calculateEnergyNeeds();
      const panelsWithRecommendation = (panelsResponse.data || []).map((panel, index) => ({
        ...panel,
        recommended: index === getRecommendedPanelIndex(panelsResponse.data || [], energyNeeds),
        quantity: calculatePanelQuantity(panel, energyNeeds),
        totalWatts: calculatePanelQuantity(panel, energyNeeds) * panel.rated_power,
        totalCost: calculatePanelQuantity(panel, energyNeeds) * panel.unit_cost
      }));

      setPanels(panelsWithRecommendation);

      // Convert sun hours array to object for easy lookup
      const sunHoursMap = {};
      (sunHoursResponse.data || []).forEach(item => {
        sunHoursMap[item.state] = item.hours;
      });
      setSunHours(sunHoursMap);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEnergyNeeds = () => {
    if (!data?.appliances) return 0;
    return data.appliances.reduce((total, appliance) => {
      const dailyEnergyWh = appliance.power * appliance.quantity * appliance.hoursPerDay;
      return total + dailyEnergyWh;
    }, 0) / 1000; // Convert to kWh
  };

  const calculatePanelQuantity = (panel, energyNeeds) => {
    const avgSunHours = 5.0; // Use average for calculation
    const dailyGenerationPerPanel = (panel.rated_power * panel.derating_factor * avgSunHours) / 1000;
    const requiredQuantity = Math.ceil((energyNeeds * 1.2) / dailyGenerationPerPanel); // 20% safety margin
    return Math.max(1, requiredQuantity);
  };

  const getRecommendedPanelIndex = (panelData, energyNeeds) => {
    // Prefer monocrystalline panels for efficiency
    const monoPanels = panelData.filter(p => p.model_name.includes('Monocrystalline'));
    if (monoPanels.length > 0) {
      // Find the most cost-effective mono panel
      const costEffectiveIndex = panelData.findIndex(p => 
        p.model_name.includes('Monocrystalline') && p.rated_power >= 400
      );
      if (costEffectiveIndex !== -1) return costEffectiveIndex;
    }
    return 0; // Default to first panel
  };

  const handleNext = () => {
    if (selectedState && selectedPanel) {
      onNext({ 
        state: selectedState, 
        panels: {
          ...selectedPanel,
          sunHours: sunHours[selectedState] || 5.0
        }
      });
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
    return sunHours[state] || 5.0;
  };

  const calculateDailyGeneration = (panel, state) => {
    const stateHours = getSunHours(state);
    return Math.round((panel.totalWatts * panel.derating_factor * stateHours) / 1000);
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">Loading panels and sun data...</div>
        </CardContent>
      </Card>
    );
  }

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
              {Object.keys(sunHours).map((state) => (
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
                        <h3 className="font-semibold text-lg">{panel.model_name}</h3>
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
                          {formatPrice(panel.totalCost)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium block">Quantity:</span>
                        <span className="text-gray-600">{panel.quantity} panels</span>
                      </div>
                      <div>
                        <span className="font-medium block">Total Power:</span>
                        <span className="text-gray-600">{panel.totalWatts}W</span>
                      </div>
                      <div>
                        <span className="font-medium block">Unit Power:</span>
                        <span className="text-gray-600">{panel.rated_power}W</span>
                      </div>
                      <div>
                        <span className="font-medium block">Efficiency:</span>
                        <span className="text-gray-600">{(panel.derating_factor * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedPanel && selectedState && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-green-900 mb-2">Your Solar Generation</h4>
              <p className="text-green-800 text-sm">
                With {selectedPanel.quantity} × {selectedPanel.model_name} panels in {selectedState}, 
                you'll generate approximately{' '}
                <strong>
                  {calculateDailyGeneration(selectedPanel, selectedState)} kWh
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
