import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Battery, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SAFETY_MARGIN = 1.30; // 30% safety margin per spec

const BatterySizing = ({ onNext, onBack, data }) => {
  const [selectedBattery, setSelectedBattery] = useState(data?.battery || null);
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBatteries();
  }, []);

  const fetchBatteries = async () => {
    try {
      setError(null);
      
      // Calculate night energy only (per spec)
      const nightEnergyKwh = calculateNightEnergy();
      
      // Apply 30% safety margin
      const nightEnergyWithMargin = nightEnergyKwh * SAFETY_MARGIN;
      
      // Get system voltage from selected inverter
      const systemVoltage = data.inverter?.voltage_bus || data.inverter?.voltage || 24;
      
      if (nightEnergyKwh <= 0) {
        setError('No night energy requirements found. Please go back and select appliances used at night.');
        setLoading(false);
        return;
      }
      
      // Get lithium battery options with voltage filtering
      const { data: lithiumOptions, error: lithiumError } = await supabase
        .rpc('calculate_lithium_battery_options', {
          night_energy_kwh: nightEnergyWithMargin,
          system_voltage: systemVoltage,
          night_duration_hours: 13
        });

      const batteryRecommendations = [];

      if (!lithiumError && lithiumOptions && lithiumOptions.length > 0) {
        batteryRecommendations.push(...lithiumOptions.map(option => ({
          ...option,
          recommended: option.is_optimal
        })));
      }

      // Get traditional battery options (AGM, Flooded)
      const traditionalChemistries = ['AGM', 'Flooded'];
      
      for (const chemistry of traditionalChemistries) {
        const { data: recommendation, error: rpcError } = await supabase
          .rpc('calculate_traditional_battery_system', {
            night_energy_kwh: nightEnergyWithMargin,
            preferred_chemistry: chemistry,
            system_voltage: systemVoltage,
            night_duration_hours: 13
          });

        if (!rpcError && recommendation && recommendation.length > 0) {
          batteryRecommendations.push({
            ...recommendation[0],
            recommended: false
          });
        }
      }
      
      if (batteryRecommendations.length === 0) {
        setError('No suitable battery systems found for your energy requirements. Please contact support.');
        toast({
          title: "No Batteries Found",
          description: "We couldn't find suitable battery systems for your needs.",
          variant: "destructive"
        });
      } else {
        // Sort by cost to show minimum size first (cheapest = minimum for requirement)
        batteryRecommendations.sort((a, b) => a.total_cost - b.total_cost);
        
        // Mark the cheapest option as recommended (minimum size)
        if (batteryRecommendations.length > 0) {
          batteryRecommendations[0].recommended = true;
        }
        
        setBatteries(batteryRecommendations);
        toast({
          title: "Battery Options Loaded",
          description: `Found ${batteryRecommendations.length} compatible systems`,
        });
      }
    } catch (error) {
      console.error('Error in fetchBatteries:', error);
      setError('Failed to load battery options. Please try again.');
      toast({
        title: "Loading Error",
        description: "Failed to load battery options. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateNightEnergy = () => {
    // Use night energy from system calculation or calculate directly
    if (data?.nightEnergy) {
      return data.nightEnergy;
    }
    
    if (!data?.appliances) return 0;
    
    // Calculate: sum(power × quantity × night hours) / 1000 for kWh
    return data.appliances.reduce((total, appliance) => {
      const power = appliance.power_w || appliance.power_rating || appliance.power || 0;
      const quantity = appliance.quantity || 1;
      const nightHours = appliance.night_hours || appliance.nightHours || 0;
      return total + (power * quantity * nightHours / 1000);
    }, 0);
  };

  const handleBatterySelect = (battery) => {
    setSelectedBattery(battery);
  };

  const handleNext = () => {
    if (selectedBattery) {
      onNext(selectedBattery);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getChemistryColor = (chemistry) => {
    switch (chemistry) {
      case 'Lithium':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'AGM':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Flooded':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p>Finding the best battery system for you...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="text-center space-y-4">
            <Button onClick={fetchBatteries} variant="outline">
              Try Again
            </Button>
            <Button onClick={onBack} variant="ghost">
              Go Back to Inverter
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (batteries.length === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No battery systems available for your energy requirements.
            </AlertDescription>
          </Alert>
          <div className="text-center space-y-4">
            <Button onClick={fetchBatteries} variant="outline">
              Retry Loading
            </Button>
            <Button onClick={onBack} variant="ghost">
              Adjust Appliances
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
          <Battery className="w-5 h-5 text-blue-500" />
          Choose Your Battery System
        </CardTitle>
        <p className="text-gray-600">Based on your nighttime usage, we recommend the highlighted option:</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {batteries.map((battery) => (
            <Card 
              key={battery.battery_id}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                selectedBattery?.battery_id === battery.battery_id 
                  ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-500' 
                  : 'hover:shadow-md border-gray-200 hover:border-gray-300'
              } ${
                battery.recommended 
                  ? 'border-green-200 bg-green-50/50' 
                  : ''
              }`}
              onClick={() => handleBatterySelect(battery)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={getChemistryColor(battery.chemistry)}>
                      {battery.chemistry}
                    </Badge>
                    {battery.recommended && (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        Best Value
                      </Badge>
                    )}
                    {selectedBattery?.battery_id === battery.battery_id && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      {formatPrice(battery.total_cost)}
                    </div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <h3 className="font-semibold text-lg mb-1">{battery.configuration}</h3>
                  <div className="text-sm text-gray-600">
                    <span><strong>Quantity:</strong> {battery.recommended_quantity} units</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  {battery.pros && battery.pros.map((pro, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      {pro}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedBattery && (
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-purple-900 mb-2">Your Selection</h4>
              <div className="text-purple-800 text-sm space-y-1">
                <p><strong>Selected:</strong> {selectedBattery.configuration}</p>
                <p><strong>Battery Type:</strong> {selectedBattery.chemistry}</p>
                <p>✓ Sufficient capacity for your nighttime power needs (with 30% safety margin)</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back to Inverter
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!selectedBattery}
            className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
          >
            Next: Choose Panels
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BatterySizing;
