import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, PanelsTopLeft, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const HEADROOM_FACTOR = 1.20; // 20% headroom per spec

const PanelSizing = ({ onNext, onBack, data }) => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedPanel, setSelectedPanel] = useState(data?.panels || null);
  const [panels, setPanels] = useState([]);
  const [sunHours, setSunHours] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const { toast } = useToast();

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
      setError(null);
      
      const { data: sunHoursData, error } = await supabase
        .from('sun_hours')
        .select('*')
        .order('state', { ascending: true });

      if (error) {
        console.error('Error fetching sun hours:', error);
        setError('Unable to load location data. Please try again.');
        toast({
          title: "Error",
          description: "Failed to load location data. Please refresh the page.",
          variant: "destructive"
        });
        return;
      }
      
      const sunHoursMap = {};
      (sunHoursData || []).forEach(item => {
        sunHoursMap[item.state] = item.hours;
      });
      setSunHours(sunHoursMap);
    } catch (error) {
      console.error('Unexpected error:', error);
      setError('An unexpected error occurred while loading location data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPanelRecommendations = async () => {
    try {
      setPanelsLoading(true);
      setError(null);
      
      // Calculate requirements per spec:
      // 1. Panels for daytime load
      // 2. Panels for battery recharge
      // 3. Take maximum + 20% headroom
      
      const daytimeLoadWatts = calculateDaytimeLoad();
      const nightEnergyKwh = calculateNightEnergy();
      const locationSunHours = sunHours[selectedState] || 5.0;
      
      // Get panel recommendations using RPC function
      const { data: panelRecommendation, error: panelError } = await supabase
        .rpc('calculate_panel_system', {
          daytime_load_watts: Math.ceil(daytimeLoadWatts * HEADROOM_FACTOR),
          night_energy_kwh: nightEnergyKwh * HEADROOM_FACTOR,
          state_name: selectedState,
          sun_hours_per_day: locationSunHours,
          preferred_panel_model: null
        });

      if (panelError) {
        console.error('Panel calculation error:', panelError);
        setError('Unable to calculate panel recommendations. Please try again.');
        toast({
          title: "Calculation Error",
          description: "Unable to generate panel recommendations.",
          variant: "destructive"
        });
        return;
      }

      const recommendations = [];
      
      if (panelRecommendation && panelRecommendation.length > 0) {
        recommendations.push({
          ...panelRecommendation[0],
          recommended: true
        });
      }

      if (recommendations.length === 0) {
        setError('No suitable panel options found for your requirements. Please try a different location.');
        toast({
          title: "No Recommendations",
          description: "No suitable panels found for your location.",
          variant: "destructive"
        });
      } else {
        setPanels(recommendations);
        toast({
          title: "Success",
          description: `Found panel recommendation for ${selectedState}`,
        });
      }
    } catch (error) {
      console.error('Error fetching panel recommendations:', error);
      setError('An error occurred while calculating panel recommendations.');
    } finally {
      setPanelsLoading(false);
    }
  };

  const calculateDaytimeLoad = () => {
    if (!data?.appliances) return 0;
    
    return data.appliances.reduce((total, appliance) => {
      const power = appliance.power_w || appliance.power_rating || appliance.power || 0;
      const quantity = appliance.quantity || 1;
      const dayHours = appliance.day_hours || appliance.dayHours || 0;
      if (dayHours > 0) {
        return total + (power * quantity);
      }
      return total;
    }, 0);
  };

  const calculateNightEnergy = () => {
    if (data?.nightEnergy) return data.nightEnergy;
    
    if (!data?.appliances) return 0;
    
    return data.appliances.reduce((total, appliance) => {
      const power = appliance.power_w || appliance.power_rating || appliance.power || 0;
      const quantity = appliance.quantity || 1;
      const nightHours = appliance.night_hours || appliance.nightHours || 0;
      return total + (power * quantity * nightHours / 1000);
    }, 0);
  };

  const handleNext = () => {
    if (selectedState && selectedPanel) {
      onNext({ 
        state: selectedState, 
        panels: selectedPanel
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

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p>Loading location data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && Object.keys(sunHours).length === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={fetchSunHours} variant="outline">
              Try Again
            </Button>
          </div>
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
        <p className="text-gray-600">Select your location to get the best panel recommendation:</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="state">Your State</Label>
          <Select onValueChange={setSelectedState} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Select your state" />
            </SelectTrigger>
            <SelectContent className="bg-white border shadow-lg z-50">
              {Object.keys(sunHours).map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedState && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>{selectedState}</strong> - Optimal panel configuration selected for your location
              </p>
            </div>
          )}
        </div>

        {selectedState && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Recommended Panel System:</h3>
            
            {panelsLoading ? (
              <Card className="p-4">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Finding the best panels for you...</p>
                </div>
              </Card>
            ) : panels.length > 0 ? (
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
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span><strong>Quantity:</strong> {panel.recommended_quantity} panels</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !panelsLoading && (
              <Card className="p-4 text-center text-gray-500">
                <p>No panel recommendations available for this location.</p>
                <p className="text-sm mt-1">Please try selecting a different state.</p>
              </Card>
            )}
          </div>
        )}

        {selectedPanel && selectedState && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-green-900 mb-2">Your Selection</h4>
              <div className="text-green-800 text-sm space-y-1">
                <p><strong>Selected:</strong> {selectedPanel.recommended_quantity} × {selectedPanel.model_name}</p>
                <p><strong>Location:</strong> {selectedState}</p>
                <p>✓ System designed to power your daytime loads and recharge batteries fully</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back to Battery
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!selectedState || !selectedPanel || panelsLoading}
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
