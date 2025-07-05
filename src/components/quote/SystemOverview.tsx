
import { Card, CardContent } from "@/components/ui/card";

interface SystemOverviewProps {
  data: any;
}

export const SystemOverview = ({ data }: SystemOverviewProps) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Selected Appliances</h3>
            <div className="space-y-1">
              {data?.appliances?.map((appliance: any, index: number) => (
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
  );
};
