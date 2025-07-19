
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, PanelsTopLeft, Sun, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PanelSizing = ({ onNext, onBack, data }) => {
  const [selectedState, setSelectedState] = useState('');
  const [selectedPanel, setSelectedPanel] = useState(data?.panels || null);
  const [panels, setPanels] = useState([]);
  const [sunHours, setSunHours] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
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
      console.log('Fetching sun hours data...');
      
      const { data: sunHoursData, error } = await supabase
        .from('sun_hours')
        .select('*')
        .order('state', { ascending: true });

      if (error) {
        console.error('Error fetching sun hours:', error);
        setError('Unable to load solar data for different states. Please try again.');
        toast({
          title: "Error",
          description: "Failed to load solar data. Please refresh the page and try again.",
          variant: "destructive"
        });
        return;
      }

      console.log('Sun hours data loaded:', sunHoursData?.length || 0, 'states');
      
      // Convert to object for easy lookup
      const sunHoursMap = {};
      (sunHoursData || []).forEach(item => {
        sunHoursMap[item.state] = item.hours;
      });
      setSunHours(sunHoursMap);
    } catch (error) {
      console.error('Unexpected error:', error);
      setError('An unexpected error occurred while loading solar data.');
      toast({
        title: "Connection Error",
        description: "Please check your internet connection and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPanelRecommendations = async () => {
    try {
      setPanelsLoading(true);
      setError(null);
      setDebugInfo(null);
      
      // Calculate daily energy needs
      const dailyEnergyKwh = calculateEnergyNeeds();
      console.log('Calculating panel recommendations for:', {
        dailyEnergyKwh,
        selectedState,
        sunHours: sunHours[selectedState]
      });

      setDebugInfo({
        dailyEnergyKwh,
        selectedState,
        sunHours: sunHours[selectedState],
        appliancesCount: data?.appliances?.length || 0
      });
      
      // Use new panel calculation with separated day/night loads
      const daytimeLoad = data?.daytimeLoad || 0;
      const nightEnergy = data?.nightEnergy || dailyEnergyKwh;
      
      console.log('Panel calculation inputs:', { daytimeLoad, nightEnergy, selectedState });
      
      // Get panel recommendations using new RPC function
      const { data: panelRecommendation, error: panelError } = await supabase
        .rpc('calculate_panel_system', {
          daytime_load_watts: daytimeLoad,
          night_energy_kwh: nightEnergy,
          state_name: selectedState,
          sun_hours_per_day: sunHours[selectedState] || 5.0,
          preferred_panel_model: null // Let it choose the best option
        });

      console.log('Panel calculation results:', {
        panelRecommendation,
        panelError
      });

      if (panelError) {
        console.error('Panel calculation error:', panelError);
        setError(`Unable to calculate panel recommendations: ${panelError?.message}`);
        toast({
          title: "Calculation Error",
          description: "Unable to generate panel recommendations. Please try again or contact support.",
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

      console.log('Final recommendations:', recommendations);

      if (recommendations.length === 0) {
        setError('No suitable panel options found for your requirements in this state. This may be due to insufficient panel data or very low energy requirements.');
        toast({
          title: "No Recommendations",
          description: "No suitable panels found for your location. Please try a different state or check your appliance selection.",
          variant: "destructive"
        });
      } else {
        setPanels(recommendations);
        toast({
          title: "Success",
          description: `Found ${recommendations.length} panel recommendation${recommendations.length > 1 ? 's' : ''} for ${selectedState}`,
        });
      }
    } catch (error) {
      console.error('Error fetching panel recommendations:', error);
      setError(`An error occurred while calculating panel recommendations: ${error.message}`);
      toast({
        title: "Calculation Error",
        description: "Unable to calculate panel recommendations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setPanelsLoading(false);
    }
  };

  const calculateEnergyNeeds = () => {
    if (data?.nightEnergy !== undefined) {
      return data.nightEnergy;
    }
    
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
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p>Loading solar data...</p>
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
        <p className="text-gray-600">First, tell us your location to optimize panel recommendations:</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {debugInfo && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="text-sm space-y-1">
                <div><strong>Daytime Load:</strong> {data?.daytimeLoad || 0}W</div>
                <div><strong>Night Energy:</strong> {debugInfo.dailyEnergyKwh.toFixed(2)} kWh</div>
                <div><strong>Location:</strong> {debugInfo.selectedState} ({debugInfo.sunHours} sun hours/day)</div>
                <div><strong>Battery Charging:</strong> {(debugInfo.dailyEnergyKwh * 1000 / debugInfo.sunHours).toFixed(0)}W</div>
                <div><strong>Total Panel Requirement:</strong> {((data?.daytimeLoad || 0) + (debugInfo.dailyEnergyKwh * 1000 / debugInfo.sunHours)).toFixed(0)}W</div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="state">Your State</Label>
          <Select onValueChange={setSelectedState} disabled={loading}>
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
            
            {panelsLoading ? (
              <Card className="p-4">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Calculating panel recommendations...</p>
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
            ) : !panelsLoading && (
              <Card className="p-4 text-center text-gray-500">
                <p>No panel recommendations available for this location.</p>
                <p className="text-sm mt-1">Please try selecting a different state or check your appliance selection.</p>
              </Card>
            )}
          </div>
        )}

        {selectedPanel && selectedState && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-green-900 mb-2">Panel Calculation</h4>
              <div className="text-green-800 text-sm space-y-1">
                <p><strong>Daytime Load:</strong> {data?.daytimeLoad || 0}W</p>
                <p><strong>Battery Charging:</strong> {((data?.nightEnergy || 0) * 1000 / (sunHours[selectedState] || 5)).toFixed(0)}W</p>
                <p><strong>Total Requirement:</strong> {((data?.daytimeLoad || 0) + ((data?.nightEnergy || 0) * 1000 / (sunHours[selectedState] || 5))).toFixed(0)}W</p>
                <p><strong>Derating Factor:</strong> 80% (accounting for losses)</p>
                <p><strong>System Losses:</strong> Inverter (90%) + Wiring (95%)</p>
                <p>Result: {selectedPanel.recommended_quantity} × {selectedPanel.rated_power}W panels generating <strong>{selectedPanel.daily_generation_kwh} kWh/day</strong></p>
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
