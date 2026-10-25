import { useToast } from "@/hooks/use-toast";
import { ApiClientError } from "@/lib/api";

/** Runs an admin mutation and reports success or the API's error message. */
export function useAdminAction() {
  const { toast } = useToast();
  return async function run<T>(action: () => Promise<T>, successMessage: string): Promise<T | null> {
    try {
      const result = await action();
      toast({ title: "Saved", description: successMessage });
      return result;
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong.";
      toast({ title: "Not saved", description: message, variant: "destructive" });
      return null;
    }
  };
}
