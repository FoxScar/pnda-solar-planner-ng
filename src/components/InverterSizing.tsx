
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const InverterSizing = ({ onNext, onBack, data }) => {
  const [selectedInverter, setSelectedInverter] = useState(data?.inverter || null);
  const [inverters, setInverters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInverters();
  }, []);

  const fetchInverters = async () => {
    try {
      // Use daytime load for inverter sizing (highest concurrent load)
      const peakLoadWatts = data?.daytimeLoad || calculateTotalPower();
      console.log('Peak load for inverter sizing:', peakLoadWatts);
      
      // Use new calculation function with power factor
      const { data: inverterRecommendations, error } = await supabase
        .rpc('calculate_inverter_with_power_factor', {
          peak_load_watts: peakLoadWatts,
          power_factor: 0.8,
          safety_margin: 0.2
        });

      if (error) {
        console.error('Error fetching inverter recommendations:', error);
        return;
      }

      console.log('Inverter recommendations:', inverterRecommendations);
      setInverters(inverterRecommendations || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPower = () => {
    if (!data?.appliances) return 0;
    // Use daytime load for inverter sizing
    return data.appliances
      .filter(app => app.period === 'day' || app.period === 'both')
      .reduce((total, appliance) => {
        return total + (appliance.power * appliance.quantity);
      }, 0);
  };

  const handleNext = () => {
    if (selectedInverter) {
      onNext(selectedInverter);
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
          <div className="text-center">Loading inverters...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" />
          Choose Your Inverter
        </CardTitle>
        <p className="text-gray-600">Based on your appliances, we recommend the highlighted option:</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {inverters.map((inverter) => (
            <Card 
              key={inverter.id}
              className={`cursor-pointer transition-all duration-200 ${
                selectedInverter?.id === inverter.id 
                  ? 'ring-2 ring-orange-500 bg-orange-50' 
                  : 'hover:shadow-md'
              } ${
                inverter.recommended 
                  ? 'border-orange-200 bg-orange-50/50' 
                  : ''
              }`}
              onClick={() => setSelectedInverter(inverter)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{inverter.model_name}</h3>
                      {inverter.recommended && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          Recommended
                        </Badge>
                      )}
                      {selectedInverter?.id === inverter.id && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Voltage:</span>
                        <span className="text-gray-600">{inverter.voltage_bus}V</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Capacity:</span>
                        <span className="text-gray-600">{inverter.kva_rating}kVA</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">VA Requirement:</span>
                        <span className="text-gray-600">{inverter.va_requirement}VA</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Surge:</span>
                        <span className="text-gray-600">{inverter.surge_capacity}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      {formatPrice(inverter.unit_cost)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedInverter && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-blue-900 mb-2">Inverter Calculation</h4>
              <div className="text-blue-800 text-sm space-y-1">
                <p><strong>Daytime Load:</strong> {data?.daytimeLoad || 0}W</p>
                <p><strong>Power Factor:</strong> 0.8 (typical for household loads)</p>
                <p><strong>VA Requirement:</strong> {selectedInverter.va_requirement}VA = {data?.daytimeLoad || 0}W ÷ 0.8</p>
                <p><strong>Safety Margin:</strong> 20% added for surge capacity</p>
                <p>The {selectedInverter.model_name} provides {selectedInverter.kva_rating}kVA capacity, sufficient for your daytime load with safety margin.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back to Appliances
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!selectedInverter}
            className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
          >
            Next: Choose Battery
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InverterSizing;
