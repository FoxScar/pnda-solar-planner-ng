
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye } from "lucide-react";

interface QuoteGenerationCardProps {
  loading: boolean;
  hasRequiredData: boolean;
  onGenerateQuote: () => void;
}

export const QuoteGenerationCard = ({ loading, hasRequiredData, onGenerateQuote }: QuoteGenerationCardProps) => {
  return (
    <Card className="bg-gradient-to-r from-orange-100 to-yellow-100 border-orange-200">
      <CardContent className="p-6 text-center">
        <h3 className="font-semibold text-lg mb-2">Get Your Detailed Quote</h3>
        <p className="text-gray-700 mb-4">
          Watch a short ad to unlock your complete pricing breakdown and quote details.
        </p>
        <Button 
          onClick={onGenerateQuote}
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
  );
};
