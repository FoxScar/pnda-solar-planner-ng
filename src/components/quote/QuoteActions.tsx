
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Share2, Save, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateQuotePDF } from "../utils/pdfGenerator";
import { formatPrice } from "../utils/formatters";

interface QuoteActionsProps {
  data: any;
  quoteData: any;
  user: any;
  saving: boolean;
  onSaveQuote: () => void;
  onNavigateToAuth: () => void;
}

export const QuoteActions = ({ 
  data, 
  quoteData, 
  user, 
  saving, 
  onSaveQuote, 
  onNavigateToAuth 
}: QuoteActionsProps) => {
  const { toast } = useToast();

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
      generateQuotePDF(data, quoteData);
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

  return (
    <>
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
            onClick={onSaveQuote}
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
                onClick={onNavigateToAuth}
                className="p-0 h-auto text-blue-600"
              >
                Sign in
              </Button>
              {' '}to save this quote and access it later.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
};
