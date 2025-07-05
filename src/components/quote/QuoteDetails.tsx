
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "../utils/formatters";

interface QuoteDetailsProps {
  data: any;
  quoteData: any;
}

export const QuoteDetails = ({ data, quoteData }: QuoteDetailsProps) => {
  return (
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
      </CardContent>
    </Card>
  );
};
