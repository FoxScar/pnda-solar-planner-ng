
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileText, Share2, Download, Eye } from "lucide-react";

const ReviewQuote = ({ onBack, data }) => {
  const [showQuote, setShowQuote] = useState(false);
  const [adWatched, setAdWatched] = useState(false);

  const mockAdWatch = () => {
    // Simulate ad watching
    setAdWatched(true);
    setShowQuote(true);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(price);
  };

  const calculateTotal = () => {
    const inverterCost = data?.inverter?.cost || 0;
    const batteryCost = data?.battery?.cost || 0;
    const panelCost = data?.panels?.panels?.cost || 0;
    const installationCost = Math.round((inverterCost + batteryCost + panelCost) * 0.15); // 15% installation
    
    return {
      subtotal: inverterCost + batteryCost + panelCost,
      installation: installationCost,
      total: inverterCost + batteryCost + panelCost + installationCost
    };
  };

  const totals = calculateTotal();

  const handleDownloadPDF = () => {
    // Placeholder for PDF generation
    alert('PDF download feature coming soon!');
  };

  const handleShareWhatsApp = () => {
    const message = `My Solar System Quote from PndaSolar:\n\nInverter: ${data?.inverter?.name}\nBattery: ${data?.battery?.configuration}\nPanels: ${data?.panels?.panels?.quantity}x ${data?.panels?.panels?.model}\n\nTotal: ${formatPrice(totals.total)}\n\nGet your quote at: https://pndasolar.com`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

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
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">System Components</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Inverter:</span>
                    <span className="font-medium">{data?.inverter?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Battery:</span>
                    <span className="font-medium">{data?.battery?.configuration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Solar Panels:</span>
                    <span className="font-medium">
                      {data?.panels?.panels?.quantity}x {data?.panels?.panels?.model}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Location:</span>
                    <span className="font-medium">{data?.panels?.state}</span>
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
                className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              >
                <Eye className="w-4 h-4 mr-2" />
                Watch Ad & Generate Quote
              </Button>
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
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>{data?.inverter?.name}</span>
                  <span className="font-medium">{formatPrice(data?.inverter?.cost || 0)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>{data?.battery?.configuration} Battery System</span>
                  <span className="font-medium">{formatPrice(data?.battery?.cost || 0)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>
                    {data?.panels?.panels?.quantity}x {data?.panels?.panels?.model}
                  </span>
                  <span className="font-medium">{formatPrice(data?.panels?.panels?.cost || 0)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(totals.subtotal)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Installation & Setup (15%)</span>
                  <span>{formatPrice(totals.installation)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Investment</span>
                  <span className="text-green-600">{formatPrice(totals.total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
                <Button 
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Share2 className="w-4 h-4" />
                  Share on WhatsApp
                </Button>
              </div>
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
