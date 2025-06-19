
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Battery } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BatterySizing = ({ onNext, onBack, data }) => {
  const [selectedBattery, setSelectedBattery] = useState(data?.battery || null);
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatteries();
  }, []);

  const fetchBatteries = async () => {
    try {
      const { data: batteryData, error } = await supabase
        .from('batteries')
        .select('*')
        .eq('available', true)
        .order('chemistry', { ascending: true })
        .order('capacity_kwh', { ascending: true });

      if (error) {
        console.error('Error fetching batteries:', error);
        return;
      }

      // Calculate recommended battery based on energy needs
      const energyNeeds = calculateEnergyNeeds();
      const batteriesWithRecommendation = (batteryData || []).map((battery, index) => ({
        ...battery,
        recommended: index === getRecommendedBatteryIndex(batteryData || [], energyNeeds),
        configuration: getBatteryConfiguration(battery),
        pros: getBatteryPros(battery.chemistry)
      }));

      setBatteries(batteriesWithRecommendation);
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

  const getRecommendedBatteryIndex = (batteryData, energyNeeds) => {
    // Look for lithium batteries first, then find one that can handle the load with some margin
    const requiredCapacity = energyNeeds * 1.3; // 30% margin
    
    const lithiumBatteries = batteryData.filter(b => b.chemistry === 'Lithium');
    if (lithiumBatteries.length > 0) {
      const recommendedLithium = lithiumBatteries.find(b => b.capacity_kwh >= requiredCapacity);
      if (recommendedLithium) {
        return batteryData.findIndex(b => b.id === recommendedLithium.id);
      }
    }
    
    // Fallback to any battery that meets requirements
    const recommendedIndex = batteryData.findIndex(battery => 
      battery.capacity_kwh >= requiredCapacity
    );
    
    return recommendedIndex === -1 ? 0 : recommendedIndex;
  };

  const getBatteryConfiguration = (battery) => {
    const voltage = battery.voltage;
    const capacity = battery.capacity_kwh;
    
    if (battery.chemistry === 'Lithium') {
      return `${Math.ceil(capacity / 2.4)} × ${capacity <= 2.4 ? '2.4kWh' : '5kWh'} ${battery.chemistry}`;
    } else {
      const ahCapacity = Math.round((capacity * 1000) / voltage);
      return `${Math.ceil(capacity / 1.2)} × ${ahCapacity}Ah ${battery.chemistry}`;
    }
  };

  const getBatteryPros = (chemistry) => {
    switch (chemistry) {
      case 'Lithium':
        return ['10+ year lifespan', 'No maintenance', 'Fast charging', '95% efficiency'];
      case 'AGM':
        return ['No maintenance', '5-7 year lifespan', 'Reliable', 'Good performance'];
      case 'Flooded':
        return ['Lowest upfront cost', 'High capacity', 'Proven technology', 'Repairable'];
      default:
        return [];
    }
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
          <div className="text-center">Loading batteries...</div>
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
        <p className="text-gray-600">Select the battery type that fits your budget and needs:</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {batteries.map((battery) => (
            <Card 
              key={battery.id}
              className={`cursor-pointer transition-all duration-200 ${
                selectedBattery?.id === battery.id 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:shadow-md'
              } ${
                battery.recommended 
                  ? 'border-green-200 bg-green-50/50' 
                  : ''
              }`}
              onClick={() => setSelectedBattery(battery)}
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
                    {selectedBattery?.id === battery.id && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      {formatPrice(battery.unit_cost)}
                    </div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <h3 className="font-semibold text-lg mb-1">{battery.configuration}</h3>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Capacity:</span>
                      <span className="text-gray-600 ml-1">{battery.capacity_kwh}kWh</span>
                    </div>
                    <div>
                      <span className="font-medium">Efficiency:</span>
                      <span className="text-gray-600 ml-1">{(battery.efficiency * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="font-medium">Depth of Discharge:</span>
                      <span className="text-gray-600 ml-1">{(battery.dod * 100).toFixed(0)}%</span>
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
                {selectedBattery.capacity_kwh}kWh of storage capacity, giving you reliable 
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
