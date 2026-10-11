import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sun, Wrench } from "lucide-react";

/**
 * Placeholder for the system recommendation step while the server-side
 * sizing engine (Phase 1) is being built. Replaced by the result page.
 */
const SystemResultPending = ({ onBack, data }) => {
  const count = data?.appliances?.length ?? 0;
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-orange-500" />
          Your Solar System
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Wrench className="h-4 w-4" />
          <AlertDescription>
            We're upgrading our sizing engine to give you an engineering-correct recommendation.
            Your {count} appliance{count === 1 ? "" : "s"} {count === 1 ? "is" : "are"} saved — check back soon.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onBack} className="w-full">
          Back to Appliances
        </Button>
      </CardContent>
    </Card>
  );
};

export default SystemResultPending;
