
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sun, Zap, Battery, PanelsTopLeft, AlertTriangle } from "lucide-react";
import ApplianceSelection from '@/components/ApplianceSelection';
import InverterSizing from '@/components/InverterSizing';
import BatterySizing from '@/components/BatterySizing';
import PanelSizing from '@/components/PanelSizing';
import ReviewQuote from '@/components/ReviewQuote';
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [applianceData, setApplianceData] = useState([]);
  const [inverterData, setInverterData] = useState(null);
  const [batteryData, setBatteryData] = useState(null);
  const [panelData, setPanelData] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const { toast } = useToast();

  const steps = [
    { name: 'Appliances', icon: Zap, component: ApplianceSelection },
    { name: 'Inverter', icon: Sun, component: InverterSizing },
    { name: 'Battery', icon: Battery, component: BatterySizing },
    { name: 'Panels', icon: PanelsTopLeft, component: PanelSizing },
    { name: 'Review', icon: Sun, component: ReviewQuote }
  ];

  // Calculate progress correctly - exclude welcome screen from calculation
  const totalSteps = steps.length;
  const completedSteps = currentStep === 0 ? 0 : currentStep;
  const progress = (completedSteps / totalSteps) * 100;

  const handleNext = (data) => {
    try {
      setGlobalError(null);
      
      console.log(`Moving from step ${currentStep} to ${currentStep + 1}`);
      console.log('Data received:', data);

      switch(currentStep) {
        case 1: // From ApplianceSelection
          if (!data || !Array.isArray(data) || data.length === 0) {
            setGlobalError('Please select at least one appliance before proceeding.');
            return;
          }
          setApplianceData(data);
          break;
        case 2: // From InverterSizing
          if (!data || !data.id) {
            setGlobalError('Please select an inverter before proceeding.');
            return;
          }
          setInverterData(data);
          break;
        case 3: // From BatterySizing
          if (!data || !data.battery_id) {
            setGlobalError('Please select a battery system before proceeding.');
            return;
          }
          setBatteryData(data);
          break;
        case 4: // From PanelSizing
          if (!data || !data.panels || !data.state) {
            setGlobalError('Please select solar panels and specify your location before proceeding.');
            return;
          }
          setPanelData(data);
          break;
      }
      
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
        toast({
          title: "Progress Saved",
          description: `Step ${currentStep} completed successfully.`,
        });
      }
    } catch (error) {
      console.error('Error in handleNext:', error);
      setGlobalError('An unexpected error occurred. Please try again.');
      toast({
        title: "Error",
        description: "An error occurred while saving your progress. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBack = () => {
    try {
      setGlobalError(null);
      if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
        console.log(`Moving back from step ${currentStep} to ${currentStep - 1}`);
      }
    } catch (error) {
      console.error('Error in handleBack:', error);
      toast({
        title: "Navigation Error",
        description: "An error occurred while navigating back. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleStart = () => {
    try {
      setGlobalError(null);
      setCurrentStep(1);
      console.log('Starting wizard from welcome screen');
    } catch (error) {
      console.error('Error starting wizard:', error);
      setGlobalError('Unable to start the wizard. Please refresh the page and try again.');
    }
  };

  // Welcome screen
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center">
              <Sun className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">PndaSolar</CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Size Your Solar System in Minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {globalError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            )}
            
            <div className="text-center space-y-4">
              <p className="text-gray-700">
                Get the perfect solar setup for your Nigerian home. We'll help you choose the right inverter, battery, and panels based on your appliances.
              </p>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium">Simple Setup</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
                    <Sun className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium">Nigerian Focused</p>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleStart}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold py-3 text-lg"
            >
              Start Sizing My Solar System
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const CurrentComponent = steps[currentStep - 1].component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header with Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">PndaSolar</h1>
            <div className="text-sm text-gray-600">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
          
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              {steps.map((step, index) => (
                <span 
                  key={index} 
                  className={`${
                    currentStep > index + 1 
                      ? 'text-green-600 font-medium' 
                      : currentStep === index + 1 
                        ? 'text-orange-600 font-medium' 
                        : ''
                  }`}
                >
                  {step.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {globalError && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Current Step Component */}
        <CurrentComponent
          onNext={handleNext}
          onBack={handleBack}
          data={{
            appliances: applianceData,
            inverter: inverterData,
            battery: batteryData,
            panels: panelData
          }}
        />
      </div>
    </div>
  );
};

export default Index;
