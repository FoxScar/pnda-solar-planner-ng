
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";

// Import the new components
import { ErrorAlerts } from './quote/ErrorAlerts';
import { SystemOverview } from './quote/SystemOverview';
import { QuoteGenerationCard } from './quote/QuoteGenerationCard';
import { QuoteDetails } from './quote/QuoteDetails';
import { QuoteActions } from './quote/QuoteActions';

const ReviewQuote = ({ onBack, data }) => {
  const [showQuote, setShowQuote] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const mockAdWatch = async () => {
    try {
      setAdWatched(true);
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
        setError('Unable to generate your quote. Please try again or contact support.');
        toast({
          title: "Quote Generation Failed",
          description: "There was an error creating your quote. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (quoteResult && quoteResult.length > 0) {
        setQuoteData(quoteResult[0]);
        setShowQuote(true);
        toast({
          title: "Quote Generated!",
          description: "Your solar system quote is ready for review.",
        });
      } else {
        setError('Quote data is incomplete. Please go back and ensure all components are selected.');
        toast({
          title: "Incomplete Quote",
          description: "Some component data is missing. Please review your selections.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Unexpected error generating quote:', error);
      setError('An unexpected error occurred while generating your quote.');
      toast({
        title: "Connection Error",
        description: "Please check your internet connection and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
    setAdWatched(false);
    setShowQuote(false);
    setQuoteData(null);
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

        {/* Ad placement between system overview and quote generation */}
        {!showQuote && (
          <div className="flex justify-center py-4">
            <div className="w-full max-w-lg">
              {/* AdSense component would go here - currently placeholder */}
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500 text-sm">
                Advertisement Space
                <br />
                <span className="text-xs">Replace with your AdSense code</span>
              </div>
            </div>
          </div>
        )}

        {!showQuote ? (
          <QuoteGenerationCard
            loading={loading}
            hasRequiredData={hasRequiredData}
            onGenerateQuote={mockAdWatch}
          />
        ) : (
          <>
            {/* Ad placement between quote generation and quote details */}
            <div className="flex justify-center py-4">
              <div className="w-full max-w-lg">
                {/* AdSense component would go here - currently placeholder */}
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500 text-sm">
                  Advertisement Space
                  <br />
                  <span className="text-xs">Replace with your AdSense code</span>
                </div>
              </div>
            </div>
            
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
