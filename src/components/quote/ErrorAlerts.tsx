
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorAlertsProps {
  hasRequiredData: boolean;
  error: string | null;
  onRetry: () => void;
}

export const ErrorAlerts = ({ hasRequiredData, error, onRetry }: ErrorAlertsProps) => {
  return (
    <>
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
              onClick={onRetry}
              className="mt-2 ml-2"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
