
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Share2, Download, Eye, AlertTriangle, Save, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';

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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(price);
  };

  const handleDownloadPDF = () => {
    if (!quoteData) {
      toast({
        title: "No Quote Available",
        description: "Please generate a quote first before downloading.",
        variant: "destructive"
      });
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(34, 197, 94); // Green color
      doc.text('PndaSolar System Quote', 20, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-NG')}`, 20, 45);
      
      // System Overview
      doc.setFontSize(16);
      doc.text('System Overview', 20, 65);
      
      let yPos = 80;
      
      // Appliances section
      doc.setFontSize(14);
      doc.text('Selected Appliances:', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      data?.appliances?.forEach((appliance, index) => {
        doc.text(`• ${appliance.quantity}x ${appliance.name} (${appliance.hoursPerDay}h/day)`, 25, yPos);
        yPos += 8;
      });
      
      yPos += 10;
      
      // Components section
      doc.setFontSize(14);
      doc.text('System Components:', 20, yPos);
      yPos += 15;
      
      doc.setFontSize(12);
      doc.text('Inverter:', 20, yPos);
      doc.text(data?.inverter?.model_name || 'Not selected', 70, yPos);
      doc.text(formatPrice(quoteData.inverter_cost), 150, yPos);
      yPos += 12;
      
      doc.text('Battery:', 20, yPos);
      doc.text(data?.battery?.configuration || 'Not selected', 70, yPos);
      doc.text(formatPrice(quoteData.battery_cost), 150, yPos);
      yPos += 12;
      
      doc.text('Solar Panels:', 20, yPos);
      doc.text(`${data?.panels?.panels?.recommended_quantity}x ${data?.panels?.panels?.model_name}` || 'Not selected', 70, yPos);
      doc.text(formatPrice(quoteData.panel_cost), 150, yPos);
      yPos += 12;
      
      doc.text('Location:', 20, yPos);
      doc.text(data?.panels?.state || 'Not selected', 70, yPos);
      yPos += 20;
      
      // Pricing breakdown
      doc.setFontSize(14);
      doc.text('Pricing Breakdown:', 20, yPos);
      yPos += 15;
      
      doc.setFontSize(12);
      doc.text('Subtotal:', 20, yPos);
      doc.text(formatPrice(quoteData.subtotal), 150, yPos);
      yPos += 12;
      
      doc.text('Installation & Setup (15%):', 20, yPos);
      doc.text(formatPrice(quoteData.installation_cost), 150, yPos);
      yPos += 20;
      
      // Total
      doc.setFontSize(16);
      doc.setTextColor(34, 197, 94);
      doc.text('Total Investment:', 20, yPos);
      doc.text(formatPrice(quoteData.total_cost), 150, yPos);
      
      // Footer
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Generated by PndaSolar - Your trusted solar energy partner', 20, 280);
      doc.text('Visit us at: https://pndasolar.com', 20, 290);
      
      // Save the PDF
      doc.save(`PndaSolar-Quote-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "PDF Downloaded!",
        description: "Your solar system quote has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Download Failed",
        description: "Unable to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleShareWhatsApp = () => {
    try {
      const message = `My Solar System Quote from PndaSolar:\n\nInverter: ${data?.inverter?.model_name}\nBattery: ${data?.battery?.configuration}\nPanels: ${data?.panels?.panels?.recommended_quantity}x ${data?.panels?.panels?.model_name}\n\nTotal: ${formatPrice(quoteData?.total_cost || 0)}\n\nGet your quote at: https://pndasolar.com`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
      toast({
        title: "Sharing Error",
        description: "Unable to share to WhatsApp. Please try again.",
        variant: "destructive"
      });
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
        {!hasRequiredData && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Some component data is missing. Please go back through the steps to ensure all components are properly selected.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={retryQuoteGeneration}
                className="mt-2 ml-2"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* System Overview */}
        <div className="space-y-4">
          <div className="grid gap-4">
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Selected Appliances</h3>
                <div className="space-y-1">
                  {data?.appliances?.map((appliance, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {appliance.quantity}x {appliance.name} ({appliance.hoursPerDay}h/day)
                    </div>
                  )) || <div className="text-sm text-gray-500">No appliances selected</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">System Components</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Inverter:</span>
                    <span className="font-medium">{data?.inverter?.model_name || 'Not selected'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Battery:</span>
                    <span className="font-medium">{data?.battery?.configuration || 'Not selected'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Solar Panels:</span>
                    <span className="font-medium">
                      {data?.panels?.panels?.recommended_quantity}x {data?.panels?.panels?.model_name || 'Not selected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Location:</span>
                    <span className="font-medium">{data?.panels?.state || 'Not selected'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quote Generation */}
        {!showQuote ? (
          <Card className="bg-gradient-to-r from-orange-100 to-yellow-100 border-orange-200">
            <CardContent className="p-6 text-center">
              <h3 className="font-semibold text-lg mb-2">Get Your Detailed Quote</h3>
              <p className="text-gray-700 mb-4">
                Watch a short ad to unlock your complete pricing breakdown and quote details.
              </p>
              <Button 
                onClick={mockAdWatch}
                disabled={loading || !hasRequiredData}
                className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              >
                <Eye className="w-4 h-4 mr-2" />
                {loading ? 'Generating Quote...' : 'Watch Ad & Generate Quote'}
              </Button>
              {!hasRequiredData && (
                <p className="text-sm text-gray-600 mt-2">
                  Please complete all previous steps to generate your quote.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-lg">Your Complete Quote</h3>
                <Badge className="bg-green-100 text-green-700">
                  Quote Generated
                </Badge>
              </div>
              
              {quoteData && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>{data?.inverter?.model_name}</span>
                    <span className="font-medium">{formatPrice(quoteData.inverter_cost)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>{data?.battery?.configuration} Battery System</span>
                    <span className="font-medium">{formatPrice(quoteData.battery_cost)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>
                      {data?.panels?.panels?.recommended_quantity}x {data?.panels?.panels?.model_name}
                    </span>
                    <span className="font-medium">{formatPrice(quoteData.panel_cost)}</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(quoteData.subtotal)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Installation & Setup (15%)</span>
                    <span>{formatPrice(quoteData.installation_cost)}</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total Investment</span>
                    <span className="text-green-600">{formatPrice(quoteData.total_cost)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2"
                  disabled={!quoteData}
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
                <Button 
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  disabled={!quoteData}
                >
                  <Share2 className="w-4 h-4" />
                  Share on WhatsApp
                </Button>
              </div>

              {/* Save Quote Section */}
              {user ? (
                <div className="mt-4">
                  <Button 
                    onClick={saveQuote}
                    disabled={saving || !quoteData}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving Quote...' : 'Save Quote to My Account'}
                  </Button>
                </div>
              ) : (
                <div className="mt-4">
                  <Alert>
                    <User className="h-4 w-4" />
                    <AlertDescription>
                      <Button 
                        variant="link" 
                        onClick={() => navigate('/auth')}
                        className="p-0 h-auto text-blue-600"
                      >
                        Sign in
                      </Button>
                      {' '}to save this quote and access it later.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
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
