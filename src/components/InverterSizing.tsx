
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
      // Calculate total peak load from appliances
      const totalPowerWatts = calculateTotalPower();
      
      // Get all available inverters for display
      const { data: inverterData, error } = await supabase
        .from('inverters')
        .select('*')
        .eq('available', true)
        .order('kva_rating', { ascending: true });

      if (error) {
        console.error('Error fetching inverters:', error);
        return;
      }

      // Find recommended inverter based on peak load
      // Simple recommendation logic: find first inverter that can handle the load with some margin
      const recommendedInverter = (inverterData || []).find(inverter => 
        (inverter.kva_rating * 1000 * 0.8) >= totalPowerWatts // 80% derating factor
      );

      // Mark the recommended inverter
      const invertersWithRecommendation = (inverterData || []).map((inverter) => ({
        ...inverter,
        recommended: recommendedInverter && inverter.id === recommendedInverter.id
      }));

      setInverters(invertersWithRecommendation);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPower = () => {
    if (!data?.appliances) return 0;
    return data.appliances.reduce((total, appliance) => {
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
                    
                    <div className="flex items-center gap-4 text-sm mb-3">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Voltage:</span>
                        <span className="text-gray-600">{inverter.voltage_bus}V</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Capacity:</span>
                        <span className="text-gray-600">{inverter.kva_rating}kVA</span>
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
              <h4 className="font-medium text-blue-900 mb-2">Why this inverter?</h4>
              <p className="text-blue-800 text-sm">
                The {selectedInverter.model_name} can handle your power requirements efficiently. 
                It provides {selectedInverter.kva_rating}kVA of power capacity, which is sufficient for 
                your selected appliances with room for future expansion.
              </p>
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
