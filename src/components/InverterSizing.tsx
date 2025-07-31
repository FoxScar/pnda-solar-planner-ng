
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateSolarSystem } from "@/components/utils/solarCalculations";

const InverterSizing = ({ onNext, onBack, data }) => {
  const [selectedInverter, setSelectedInverter] = useState(data?.inverter || null);
  const [inverters, setInverters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('InverterSizing component mounted, data:', data);
    fetchInverters();
  }, []);

  const fetchInverters = async () => {
    console.log('fetchInverters called with data:', data);
    try {
      // Get calculated system requirements
      const systemCalc = data?.systemCalculation || calculateSolarSystem(data?.appliances || []);
      const peakLoadWatts = systemCalc.totalLoadW;
      const minInverterKva = systemCalc.calculations.minInverterKva;
      
      console.log('Peak load for inverter sizing:', peakLoadWatts);
      console.log('Minimum inverter KVA needed:', minInverterKva);
      console.log('Recommended inverter:', systemCalc.inverterKva);
      
      // Use calculation function with merging capability
      const { data: inverterRecommendations, error } = await supabase
        .rpc('calculate_inverter_with_merging', {
          peak_load_watts: peakLoadWatts,
          power_factor: systemCalc.calculations.powerFactor,
          safety_margin: systemCalc.calculations.surgeMargin - 1 // Convert from 1.5 to 0.5
        });

      if (error) {
        console.error('Error fetching inverter recommendations:', error);
        return;
      }

      console.log('Inverter recommendations:', inverterRecommendations);
      
      // Add calculation details to each recommendation
      const enrichedRecommendations = (inverterRecommendations || []).map(inv => ({
        ...inv,
        calculationDetails: {
          peakLoadWatts,
          minInverterKva,
          recommendedFromCalc: systemCalc.inverterKva
        }
      }));
      
      setInverters(enrichedRecommendations);
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
      // Pass both the inverter and the voltage for battery compatibility
      onNext({
        ...selectedInverter,
        voltage: selectedInverter.voltage_bus // Ensure voltage is available for battery filtering
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

  console.log('InverterSizing render - loading:', loading, 'inverters:', inverters.length, 'selectedInverter:', selectedInverter);
  
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
              key={inverter.inverter_id}
              className={`cursor-pointer transition-all duration-200 ${
                selectedInverter?.inverter_id === inverter.inverter_id 
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
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <h3 className="font-semibold text-lg">
                      {inverter.is_merged ? inverter.merge_configuration : inverter.model_name}
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {inverter.recommended && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          Recommended
                        </Badge>
                      )}
                      {inverter.is_merged && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                          Merged System
                        </Badge>
                      )}
                      {selectedInverter?.inverter_id === inverter.inverter_id && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Voltage:</span>
                        <span className="text-gray-600">{inverter.voltage_bus}V</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Total Capacity:</span>
                        <span className="text-gray-600">{inverter.kva_rating}kVA</span>
                      </div>
                      {inverter.quantity > 1 && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Quantity:</span>
                          <span className="text-gray-600">{inverter.quantity} units</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Surge:</span>
                        <span className="text-gray-600">{inverter.surge_capacity}</span>
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
              <h4 className="font-medium text-blue-900 mb-2">Your Selection</h4>
              <div className="text-blue-800 text-sm space-y-1">
                <p><strong>Selected:</strong> {selectedInverter.is_merged ? selectedInverter.merge_configuration : selectedInverter.model_name}</p>
                <p><strong>Total Capacity:</strong> {selectedInverter.kva_rating}kVA</p>
                <p><strong>Your Load:</strong> {data?.daytimeLoad || 0}W</p>
                {selectedInverter.is_merged && (
                  <p className="text-blue-600"><strong>Note:</strong> This is a merged configuration for higher capacity needs.</p>
                )}
                <p>✓ Suitable for your daytime appliance load with safety margin included.</p>
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
