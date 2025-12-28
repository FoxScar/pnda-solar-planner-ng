import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";

// Import the new components
import { ErrorAlerts } from './quote/ErrorAlerts';
import { SystemOverview } from './quote/SystemOverview';
import { QuoteDetails } from './quote/QuoteDetails';
import { QuoteActions } from './quote/QuoteActions';
import AdSense from './AdSense';

const AD_WATCH_DURATION = 5; // Seconds user must wait
const QUOTE_VALIDITY_DAYS = 3;

const ReviewQuote = ({ onBack, data }) => {
  const [showQuote, setShowQuote] = useState(false);
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(AD_WATCH_DURATION);
  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle ad countdown timer
  useEffect(() => {
    let timer;
    if (adWatching && adCountdown > 0) {
      timer = setTimeout(() => {
        setAdCountdown(prev => prev - 1);
      }, 1000);
    } else if (adWatching && adCountdown === 0) {
      // Ad completed, generate quote
      generateQuote();
    }
    return () => clearTimeout(timer);
  }, [adWatching, adCountdown]);

  const startAdWatch = () => {
    setAdWatching(true);
    setAdCountdown(AD_WATCH_DURATION);
  };

  const generateQuote = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Generate quote data using RPC function
      const selectedComponents = {
        inverter: {
          id: data?.inverter?.id,
          model_name: data?.inverter?.model_name,
          unit_cost: data?.inverter?.unit_cost
        },
        battery: {
          id: data?.battery?.battery_id,
          configuration: data?.battery?.configuration,
          total_cost: data?.battery?.total_cost
        },
        panels: {
          id: data?.panels?.panels?.panel_id,
          model_name: data?.panels?.panels?.model_name,
          quantity: data?.panels?.panels?.recommended_quantity,
          total_cost: data?.panels?.panels?.total_cost
        }
      };

      const { data: quoteResult, error } = await supabase
        .rpc('generate_quote_data', {
          selected_components: selectedComponents
        });

      if (error) {
        console.error('Error generating quote:', error);
        setError('Unable to generate your quote. Please try again.');
        toast({
          title: "Quote Generation Failed",
          description: "There was an error creating your quote.",
          variant: "destructive"
        });
        return;
      }

      if (quoteResult && quoteResult.length > 0) {
        // Add validity date
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);
        
        setQuoteData({
          ...quoteResult[0],
          valid_until: validUntil.toISOString()
        });
        setShowQuote(true);
        toast({
          title: "Quote Generated!",
          description: "Your solar system quote is ready.",
        });
      } else {
        setError('Quote data is incomplete. Please review your selections.');
        toast({
          title: "Incomplete Quote",
          description: "Some component data is missing.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Unexpected error generating quote:', error);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
      setAdWatching(false);
    }
  };

  const saveQuote = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save your quote.",
        variant: "destructive"
      });
      return;
    }

    if (!quoteData) {
      toast({
        title: "No Quote to Save",
        description: "Please generate a quote first.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      const quoteToSave = {
        user_id: user.id,
        quote_data: quoteData,
        appliances_data: data?.appliances || [],
        inverter_data: data?.inverter || {},
        battery_data: data?.battery || {},
        panel_data: data?.panels || {},
        total_cost: quoteData.total_cost || 0
      };

      const { error } = await supabase
        .from('quotes')
        .insert([quoteToSave]);

      if (error) {
        throw error;
      }

      toast({
        title: "Quote Saved!",
        description: "Your quote has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save your quote. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const retryQuoteGeneration = () => {
    setError(null);
    setAdWatching(false);
    setShowQuote(false);
    setQuoteData(null);
    setAdCountdown(AD_WATCH_DURATION);
  };

  const formatValidityDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Check if we have all required data
  const hasRequiredData = data?.inverter && data?.battery && data?.panels?.panels && data?.appliances;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-500" />
          Your Solar System Summary
        </CardTitle>
        <p className="text-gray-600">Review your complete solar solution:</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <ErrorAlerts
          hasRequiredData={hasRequiredData}
          error={error}
          onRetry={retryQuoteGeneration}
        />

        <SystemOverview data={data} />

        {/* Ad Gate Section */}
        {!showQuote && !adWatching && (
          <Card className="border-2 border-dashed border-orange-300 bg-orange-50">
            <CardContent className="p-6 text-center">
              <Lock className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Unlock Your Quote</h3>
              <p className="text-gray-600 mb-4">
                View a brief message to reveal your complete quote with pricing details.
              </p>
              
              {/* Ad placeholder */}
              <div className="mb-4">
                <AdSense adSlot="1234567890" adFormat="rectangle" />
              </div>
              
              <Button 
                onClick={startAdWatch}
                disabled={loading || !hasRequiredData}
                className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              >
                {loading ? 'Generating...' : 'View Message & Get Quote'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Ad Watching State */}
        {adWatching && !showQuote && (
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <AdSense adSlot="1234567890" adFormat="rectangle" />
              </div>
              
              <div className="flex items-center justify-center gap-2 text-blue-700">
                <Clock className="w-5 h-5 animate-pulse" />
                <span className="font-medium">
                  {adCountdown > 0 
                    ? `Your quote will be ready in ${adCountdown} seconds...` 
                    : 'Generating your quote...'
                  }
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-blue-200 rounded-full h-2 mt-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${((AD_WATCH_DURATION - adCountdown) / AD_WATCH_DURATION) * 100}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Details (only shown after ad) */}
        {showQuote && quoteData && (
          <>
            {/* Validity Notice */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Clock className="w-5 h-5" />
                  <span>
                    <strong>Quote valid until:</strong> {formatValidityDate(quoteData.valid_until)}
                    <span className="text-amber-600 ml-2">({QUOTE_VALIDITY_DAYS} days)</span>
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <QuoteDetails data={data} quoteData={quoteData} />
            <QuoteActions
              data={data}
              quoteData={quoteData}
              user={user}
              saving={saving}
              onSaveQuote={saveQuote}
              onNavigateToAuth={() => navigate('/auth')}
            />
          </>
        )}

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back to Panels
          </Button>
          <Button 
            className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            onClick={() => window.location.reload()}
          >
            Start New Quote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewQuote;
