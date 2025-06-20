
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
    fetchSunHours();
  }, []);

  useEffect(() => {
    if (selectedState) {
      fetchPanelRecommendations();
    }
  }, [selectedState]);

  const fetchSunHours = async () => {
    try {
      const { data: sunHoursData, error } = await supabase
        .from('sun_hours')
        .select('*')
        .order('state', { ascending: true });

      if (error) {
        console.error('Error fetching sun hours:', error);
        return;
      }

      // Convert to object for easy lookup
      const sunHoursMap = {};
      (sunHoursData || []).forEach(item => {
        sunHoursMap[item.state] = item.hours;
      });
      setSunHours(sunHoursMap);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPanelRecommendations = async () => {
    try {
      // Calculate daily energy needs
      const dailyEnergyKwh = calculateEnergyNeeds();
      
      // Get panel recommendations using RPC for different models
      const { data: monoRecommendation, error: monoError } = await supabase
        .rpc('calculate_panel_system', {
          daily_energy_kwh: dailyEnergyKwh,
          state_name: selectedState,
          preferred_panel_model: 'Monocrystalline 400W'
        });

      const { data: polyRecommendation, error: polyError } = await supabase
        .rpc('calculate_panel_system', {
          daily_energy_kwh: dailyEnergyKwh,
          state_name: selectedState,
          preferred_panel_model: 'Polycrystalline 400W'
        });

      const recommendations = [];
      
      if (!monoError && monoRecommendation && monoRecommendation.length > 0) {
        recommendations.push({
          ...monoRecommendation[0],
          recommended: true // Prefer monocrystalline
        });
      }

      if (!polyError && polyRecommendation && polyRecommendation.length > 0) {
        recommendations.push({
          ...polyRecommendation[0],
          recommended: false
        });
      }

      setPanels(recommendations);
    } catch (error) {
      console.error('Error fetching panel recommendations:', error);
    }
  };

  const calculateEnergyNeeds = () => {
    if (!data?.appliances) return 0;
    return data.appliances.reduce((total, appliance) => {
      const dailyEnergyWh = appliance.power * appliance.quantity * appliance.hoursPerDay;
      return total + dailyEnergyWh;
    }, 0) / 1000; // Convert to kWh
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

        {selectedState && panels.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Recommended Panel Options:</h3>
            
            <div className="grid gap-4">
              {panels.map((panel) => (
                <Card 
                  key={panel.panel_id}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedPanel?.panel_id === panel.panel_id 
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
                        {selectedPanel?.panel_id === panel.panel_id && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {formatPrice(panel.total_cost)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium block">Quantity:</span>
                        <span className="text-gray-600">{panel.recommended_quantity} panels</span>
                      </div>
                      <div>
                        <span className="font-medium block">Total Power:</span>
                        <span className="text-gray-600">{panel.total_watts}W</span>
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
                With {selectedPanel.recommended_quantity} × {selectedPanel.model_name} panels in {selectedState}, 
                you'll generate approximately{' '}
                <strong>
                  {selectedPanel.daily_generation_kwh} kWh
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
