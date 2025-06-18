
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Battery } from "lucide-react";

const BatterySizing = ({ onNext, onBack, data }) => {
  const [selectedBattery, setSelectedBattery] = useState(data?.battery || null);

  // Mock battery data - in real app this would come from backend calculations
  const batteries = [
    {
      id: 1,
      chemistry: 'Lithium',
      configuration: '2×5kWh Lithium',
      totalCapacity: '10kWh',
      cost: 450000,
      recommended: true,
      description: 'Long-lasting, maintenance-free, best value over time',
      pros: ['10+ year lifespan', 'No maintenance', 'Fast charging']
    },
    {
      id: 2,
      chemistry: 'AGM',
      configuration: '4×100Ah AGM',
      totalCapacity: '9.6kWh',
      cost: 280000,
      recommended: false,
      description: 'Sealed, no maintenance required, good performance',
      pros: ['No maintenance', '5-7 year lifespan', 'Reliable']
    },
    {
      id: 3,
      chemistry: 'Flooded',
      configuration: '6×100Ah Flooded',
      totalCapacity: '14.4kWh',
      cost: 180000,
      recommended: false,
      description: 'Most affordable option, requires regular maintenance',
      pros: ['Lowest upfront cost', 'High capacity', 'Proven technology']
    }
  ];

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
                      {formatPrice(battery.cost)}
                    </div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <h3 className="font-semibold text-lg mb-1">{battery.configuration}</h3>
                  <p className="text-gray-600 text-sm mb-2">{battery.description}</p>
                  <div className="text-sm">
                    <span className="font-medium">Total Capacity:</span>
                    <span className="text-gray-600 ml-1">{battery.totalCapacity}</span>
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
                {selectedBattery.totalCapacity} of storage capacity, giving you reliable 
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
