import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Battery, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateSolarSystem } from "@/components/utils/solarCalculations";

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
      
      // Get calculated system requirements
      const systemCalc = data?.systemCalculation || calculateSolarSystem(data?.appliances || []);
      const nightEnergyKwh = systemCalc.nightLoadWh / 1000; // Convert to kWh
      const batteryCapacityAh = systemCalc.calculations.batteryCapacityAh;
      
      console.log('System calculation for batteries:', {
        nightEnergyKwh,
        batteryCapacityAh,
        recommendedConfig: systemCalc.batteryConfig
      });
      
      if (nightEnergyKwh <= 0) {
        setError('No night energy requirements found. Please go back and select appliances used at night.');
        setLoading(false);
        return;
      }
      
      // Get lithium battery options (multiple configurations)
      const { data: lithiumOptions, error: lithiumError } = await supabase
        .rpc('calculate_lithium_battery_options', {
          night_energy_kwh: nightEnergyKwh,
          night_duration_hours: systemCalc.calculations.autonomyHours
        });

      const batteryRecommendations = [];

      if (lithiumError) {
        console.error('Error fetching lithium batteries:', lithiumError);
      } else if (lithiumOptions && lithiumOptions.length > 0) {
        console.log('Found lithium options:', lithiumOptions);
        batteryRecommendations.push(...lithiumOptions.map(option => ({
          ...option,
          recommended: option.is_optimal
        })));
      }

      // Get traditional battery options (AGM, Flooded)
      const traditionalChemistries = ['AGM', 'Flooded'];
      
      for (const chemistry of traditionalChemistries) {
        console.log(`Fetching ${chemistry} batteries for ${nightEnergyKwh} kWh night energy...`);
        
        const { data: recommendation, error: rpcError } = await supabase
          .rpc('calculate_traditional_battery_system', {
            night_energy_kwh: nightEnergyKwh,
            preferred_chemistry: chemistry,
            night_duration_hours: systemCalc.calculations.autonomyHours
          });

        if (rpcError) {
          console.error(`Error fetching ${chemistry} batteries:`, rpcError);
          continue;
        }

        if (recommendation && recommendation.length > 0) {
          console.log(`Found ${chemistry} recommendation:`, recommendation[0]);
          batteryRecommendations.push({
            ...recommendation[0],
            recommended: false // Traditional batteries not preferred
          });
        } else {
          console.log(`No ${chemistry} batteries found for energy requirements`);
        }
      }

      console.log('All battery recommendations:', batteryRecommendations);
      
      if (batteryRecommendations.length === 0) {
        setError('No suitable battery systems found for your energy requirements. Please contact support.');
        toast({
          title: "No Batteries Found",
          description: "We couldn't find suitable battery systems for your energy needs. Please try reducing your appliance usage or contact support.",
          variant: "destructive"
        });
      } else {
        // Add calculation details to each recommendation
        const enrichedBatteries = batteryRecommendations.map(battery => ({
          ...battery,
          calculationDetails: {
            nightEnergyKwh,
            batteryCapacityAh,
            recommendedFromCalc: systemCalc.batteryConfig,
            autonomyHours: systemCalc.calculations.autonomyHours
          }
        }));
        
        setBatteries(enrichedBatteries);
        toast({
          title: "Battery Options Loaded",
          description: `Found ${batteryRecommendations.length} battery system options for your needs.`,
        });
      }
    } catch (error) {
      console.error('Error in fetchBatteries:', error);
      setError('Failed to load battery options. Please try again or contact support.');
      toast({
        title: "Loading Error",
        description: "Failed to load battery options. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateEnergyNeeds = () => {
    // Use night energy from the system calculation
    const systemCalc = data?.systemCalculation || calculateSolarSystem(data?.appliances || []);
    return systemCalc.nightLoadWh / 1000; // Convert to kWh
  };

  const handleBatterySelect = (battery) => {
    console.log('Battery selected:', battery);
    setSelectedBattery(battery);
  };

  const handleNext = () => {
    console.log('Next button clicked, selected battery:', selectedBattery);
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
            <p>Loading battery options...</p>
            <p className="text-sm text-gray-500 mt-2">Analyzing your energy needs...</p>
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
              Go Back to Appliances
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
            <p className="text-gray-600">
              Night energy requirement: {calculateEnergyNeeds().toFixed(2)} kWh
            </p>
            <div className="space-x-4">
              <Button onClick={fetchBatteries} variant="outline">
                Retry Loading
              </Button>
              <Button onClick={onBack} variant="ghost">
                Adjust Appliances
              </Button>
            </div>
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
        <p className="text-gray-600">
          Select the battery type that fits your budget and needs:
        </p>
        <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
          Night energy requirement: {calculateEnergyNeeds().toFixed(2)} kWh (13 hours: 6 PM - 7 AM)
        </div>
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
                        Recommended
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
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Total Capacity:</span>
                      <span className="text-gray-600 ml-1">{battery.total_capacity_kwh}kWh</span>
                    </div>
                    <div>
                      <span className="font-medium">Quantity:</span>
                      <span className="text-gray-600 ml-1">{battery.recommended_quantity} units</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  {battery.pros.map((pro, index) => (
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
                <p><strong>Total Capacity:</strong> {selectedBattery.total_capacity_kwh}kWh</p>
                <p><strong>Your Night Energy:</strong> {calculateEnergyNeeds().toFixed(2)} kWh</p>
                <p><strong>Battery Type:</strong> {selectedBattery.chemistry}</p>
                {selectedBattery.chemistry === 'Lithium' && selectedBattery.is_optimal && (
                  <p className="text-green-600"><strong>✓ Most cost-effective lithium option</strong></p>
                )}
                <p>✓ Sufficient capacity for your nighttime energy needs.</p>
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
