import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Zap, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MAX_INVERTER_KVA = 12; // Maximum supported inverter size
const DERATING_FACTOR = 0.8; // 80% derating

const InverterSizing = ({ onNext, onBack, data }) => {
  const [selectedInverter, setSelectedInverter] = useState(data?.inverter || null);
  const [inverters, setInverters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exceedsMaxCapacity, setExceedsMaxCapacity] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInverters();
  }, []);

  const fetchInverters = async () => {
    try {
      // Calculate daytime peak load only (per spec)
      const daytimePeakWatts = calculateDaytimePeakLoad();
      
      // Apply 80% derating: actual capacity = rated capacity × 0.8
      // So required kVA = peak load / (0.8 × 1000)
      const requiredKva = daytimePeakWatts / (DERATING_FACTOR * 1000);
      
      // Check if exceeds maximum capacity
      if (requiredKva > MAX_INVERTER_KVA) {
        setExceedsMaxCapacity(true);
        setLoading(false);
        toast({
          title: "Load Too High",
          description: "Your daytime load exceeds our maximum inverter capacity. Please reduce your appliances.",
          variant: "destructive"
        });
        return;
      }
      
      // Use calculation function with merging capability
      const { data: inverterRecommendations, error } = await supabase
        .rpc('calculate_inverter_with_merging', {
          peak_load_watts: daytimePeakWatts,
          power_factor: 0.8,
          safety_margin: 0.2 // 20% safety margin
        });

      if (error) {
        console.error('Error fetching inverter recommendations:', error);
        toast({
          title: "Error",
          description: "Failed to load inverter options. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Filter out inverters that exceed 12kVA
      const validInverters = (inverterRecommendations || []).filter(
        inv => inv.kva_rating <= MAX_INVERTER_KVA
      );
      
      setInverters(validInverters);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An error occurred while loading inverters.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDaytimePeakLoad = () => {
    if (!data?.appliances) return 0;
    // Sum of all appliance power × quantity (for daytime use)
    return data.appliances.reduce((total, appliance) => {
      const power = appliance.power_w || appliance.power_rating || appliance.power || 0;
      const quantity = appliance.quantity || 1;
      // Only count appliances used during the day
      if (appliance.day_hours > 0 || appliance.dayHours > 0) {
        return total + (power * quantity);
      }
      return total;
    }, 0);
  };

  const handleNext = () => {
    if (selectedInverter) {
      onNext({
        ...selectedInverter,
        voltage: selectedInverter.voltage_bus
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
            <p>Finding the best inverter for you...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show friendly error if load exceeds capacity
  if (exceedsMaxCapacity) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">Your power requirements are too high</p>
              <p className="mt-1">Our maximum inverter capacity is 12kVA. Please go back and reduce the number of appliances or their usage to continue.</p>
            </AlertDescription>
          </Alert>
          <div className="text-center">
            <Button onClick={onBack} variant="outline">
              Go Back and Adjust Appliances
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
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">
                        {inverter.is_merged ? inverter.merge_configuration : inverter.model_name}
                      </h3>
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
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span><strong>Capacity:</strong> {inverter.kva_rating}kVA</span>
                      {inverter.quantity > 1 && (
                        <span><strong>Quantity:</strong> {inverter.quantity} units</span>
                      )}
                      {inverter.surge_capacity && (
                        <span><strong>Surge:</strong> {inverter.surge_capacity}</span>
                      )}
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
                <p><strong>Capacity:</strong> {selectedInverter.kva_rating}kVA</p>
                {selectedInverter.is_merged && (
                  <p className="text-blue-600">This is a merged configuration for higher capacity needs.</p>
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
