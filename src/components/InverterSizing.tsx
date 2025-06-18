
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap } from "lucide-react";

const InverterSizing = ({ onNext, onBack, data }) => {
  const [selectedInverter, setSelectedInverter] = useState(data?.inverter || null);

  // Mock inverter data - in real app this would come from backend
  const inverters = [
    {
      id: 1,
      name: 'Felicity 1.5kVA Inverter',
      voltage: '12V',
      kva: '1.5kVA',
      cost: 85000,
      recommended: true,
      description: 'Perfect for small homes with basic appliances'
    },
    {
      id: 2,
      name: 'Felicity 2.5kVA Inverter',
      voltage: '24V',
      kva: '2.5kVA',
      cost: 120000,
      recommended: false,
      description: 'Great for medium homes with more appliances'
    },
    {
      id: 3,
      name: 'Felicity 3.5kVA Inverter',
      voltage: '24V',
      kva: '3.5kVA',
      cost: 165000,
      recommended: false,
      description: 'Ideal for larger homes with high power needs'
    },
    {
      id: 4,
      name: 'Felicity 5kVA Inverter',
      voltage: '48V',
      kva: '5kVA',
      cost: 220000,
      recommended: false,
      description: 'Best for homes with AC units and heavy appliances'
    }
  ];

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
                      <h3 className="font-semibold text-lg">{inverter.name}</h3>
                      {inverter.recommended && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          Recommended
                        </Badge>
                      )}
                      {selectedInverter?.id === inverter.id && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3">{inverter.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Voltage:</span>
                        <span className="text-gray-600">{inverter.voltage}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Capacity:</span>
                        <span className="text-gray-600">{inverter.kva}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      {formatPrice(inverter.cost)}
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
                The {selectedInverter.name} can handle your power requirements efficiently. 
                It provides {selectedInverter.kva} of power capacity, which is sufficient for 
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
