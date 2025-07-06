import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Battery, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      
      // Calculate daily energy needs
      const dailyEnergyKwh = calculateEnergyNeeds();
      console.log('Daily energy needs (kWh):', dailyEnergyKwh);
      
      if (dailyEnergyKwh <= 0) {
        setError('No energy requirements found. Please go back and select your appliances.');
        setLoading(false);
        return;
      }
      
      // Get battery recommendations using RPC for different chemistries
      const chemistries = ['Lithium', 'AGM', 'Flooded'];
      const batteryRecommendations = [];

      for (const chemistry of chemistries) {
        console.log(`Fetching ${chemistry} batteries for ${dailyEnergyKwh} kWh daily energy...`);
        
        const { data: recommendation, error: rpcError } = await supabase
          .rpc('calculate_battery_system', {
            daily_energy_kwh: dailyEnergyKwh,
            preferred_chemistry: chemistry
          });

        if (rpcError) {
          console.error(`Error fetching ${chemistry} batteries:`, rpcError);
          continue;
        }

        if (recommendation && recommendation.length > 0) {
          console.log(`Found ${chemistry} recommendation:`, recommendation[0]);
          batteryRecommendations.push({
            ...recommendation[0],
            recommended: chemistry === 'Lithium' // Prefer Lithium
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
        setBatteries(batteryRecommendations);
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
    if (!data?.appliances || !Array.isArray(data.appliances)) {
      console.error('No appliances data found:', data);
      return 0;
    }
    
    const totalEnergyWh = data.appliances.reduce((total, appliance) => {
      const power = appliance.power || appliance.power_rating || 0;
      const quantity = appliance.quantity || 1;
      const hours = appliance.hoursPerDay || 0;
      const dailyEnergyWh = power * quantity * hours;
      
      console.log(`Appliance: ${appliance.name}, Power: ${power}W, Qty: ${quantity}, Hours: ${hours}, Daily: ${dailyEnergyWh}Wh`);
      
      return total + dailyEnergyWh;
    }, 0);
    
    console.log(`Total daily energy: ${totalEnergyWh}Wh = ${totalEnergyWh / 1000}kWh`);
    return totalEnergyWh / 1000; // Convert to kWh
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
              Daily energy requirement: {calculateEnergyNeeds().toFixed(2)} kWh
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
          Daily energy requirement: {calculateEnergyNeeds().toFixed(2)} kWh
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
              <h4 className="font-medium text-purple-900 mb-2">Battery Storage Explained</h4>
              <p className="text-purple-800 text-sm">
                Your {selectedBattery.configuration} system will store enough energy to power 
                your appliances when the sun isn't shining. This setup provides 
                {selectedBattery.total_capacity_kwh}kWh of storage capacity, giving you reliable 
                backup power for your home.
              </p>
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
