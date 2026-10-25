
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sun, Zap, MapPin, AlertTriangle, User, FileText, LogOut } from "lucide-react";
import ApplianceSelection from '@/components/ApplianceSelection';
import LocationStep from '@/components/LocationStep';
import SystemResult from '@/components/SystemResult';
import SavedQuotes from '@/components/SavedQuotes';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import pndaSolarLogo from '@/assets/pnda-solar-simple-logo.png';

const WIZARD_STEP_COUNT = 3;

const Index = () => {
  const [currentStep, setCurrentStep] = useState(() => {
    // Clamp: older versions of the wizard had more steps.
    const saved = parseInt(localStorage.getItem('solar-wizard-step') ?? '0', 10);
    return Number.isFinite(saved) ? Math.min(Math.max(saved, 0), WIZARD_STEP_COUNT) : 0;
  });
  const [applianceData, setApplianceData] = useState(() => {
    const saved = localStorage.getItem('solar-wizard-appliances');
    return saved ? JSON.parse(saved) : [];
  });
  const [locationData, setLocationData] = useState(() => {
    const saved = localStorage.getItem('solar-wizard-location');
    return saved ? JSON.parse(saved) : null;
  });
  const [globalError, setGlobalError] = useState(null);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-save data to localStorage
  useEffect(() => {
    localStorage.setItem('solar-wizard-step', currentStep.toString());
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem('solar-wizard-appliances', JSON.stringify(applianceData));
  }, [applianceData]);

  useEffect(() => {
    localStorage.setItem('solar-wizard-location', JSON.stringify(locationData));
  }, [locationData]);

  const steps = [
    { name: 'Appliances', icon: Zap, component: ApplianceSelection },
    { name: 'Location', icon: MapPin, component: LocationStep },
    { name: 'Your System', icon: Sun, component: SystemResult }
  ];

  // Calculate progress correctly - exclude welcome screen from calculation
  const totalSteps = steps.length;
  const completedSteps = currentStep === 0 ? 0 : currentStep;
  const progress = (completedSteps / totalSteps) * 100;

  const clearLocalStorage = () => {
    localStorage.removeItem('solar-wizard-step');
    localStorage.removeItem('solar-wizard-appliances');
    localStorage.removeItem('solar-wizard-location');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentStep(0);
      setApplianceData([]);
      setLocationData(null);
      setShowSavedQuotes(false);
      clearLocalStorage();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Error",
        description: "There was a problem signing out. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleNext = (data) => {
    try {
      setGlobalError(null);
      
      console.log(`Moving from step ${currentStep} to ${currentStep + 1}`);
      console.log('Data received:', data);

      switch(currentStep) {
        case 1: // From ApplianceSelection
          if (!data || !Array.isArray(data.appliances) || data.appliances.length === 0) {
            setGlobalError('Please select at least one appliance before proceeding.');
            return;
          }
          setApplianceData(data.appliances);
          break;
        case 2: // From LocationStep
          if (!data?.location?.state) {
            setGlobalError('Please select your state before proceeding.');
            return;
          }
          setLocationData(data.location);
          break;
      }
      
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
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
      if (showSavedQuotes) {
        setShowSavedQuotes(false);
        return;
      }
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

  // Show saved quotes if requested
  if (showSavedQuotes) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">P'NDA SOLAR</h1>
              {user && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-600 hidden md:inline truncate">{user.email}</span>
                  <Button variant="outline" onClick={handleSignOut} className="h-11 px-3" aria-label="Sign out">
                    <LogOut className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <SavedQuotes 
            onBack={() => setShowSavedQuotes(false)} 
          />
        </div>
      </div>
    );
  }

  // Welcome screen
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardHeader className="text-center pb-2">
            <img 
              src={pndaSolarLogo} 
              alt="P'NDA SOLAR Logo"
              className="w-48 h-32 mx-auto mb-4 object-contain"
            />
            
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

            {/* Authentication Status */}
            {loading ? (
              <div className="text-center py-2">
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            ) : user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                  <User className="w-4 h-4" />
                  <span>Signed in as {user.email}</span>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => setShowSavedQuotes(true)}
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Saved Quotes
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button 
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="w-full"
                >
                  <User className="w-4 h-4 mr-2" />
                  Sign In to Save Quotes
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Button 
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold py-3 text-lg"
              >
                {applianceData.length > 0 ? 'Continue Where I Left Off' : 'Start Sizing My Solar System'}
              </Button>
              {(applianceData.length > 0) && (
                <Button 
                  onClick={() => {
                    setCurrentStep(0);
                    setApplianceData([]);
                    setLocationData(null);
                    clearLocalStorage();
                    toast({
                      title: "Progress Cleared",
                      description: "All saved progress has been cleared.",
                    });
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Start Fresh
                </Button>
              )}
            </div>
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
          <div className="flex items-center justify-between gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900">P'NDA SOLAR</h1>
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden md:inline">{user.email}</span>
                <Button variant="outline" onClick={() => setShowSavedQuotes(true)} className="h-11 px-3" aria-label="My quotes">
                  <FileText className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">My Quotes</span>
                </Button>
                <Button variant="outline" onClick={handleSignOut} className="h-11 px-3" aria-label="Sign out">
                  <LogOut className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-3">Step {currentStep} of {totalSteps}</p>
          
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
            location: locationData
          }}
        />
      </div>
    </div>
  );
};

export default Index;
