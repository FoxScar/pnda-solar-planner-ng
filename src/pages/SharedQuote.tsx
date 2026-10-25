import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Download, Loader2, Sun } from "lucide-react";
import QuoteSummary from "@/components/quote/QuoteSummary";
import { api, ApiClientError } from "@/lib/api";
import type { QuoteView } from "@/lib/quotes";

/** Public, read-only quote opened from a shared link (PRD §29.2). */
const SharedQuote = () => {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<QuoteView>(`/public/quotes/${token}`)
      .then(setQuote)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Could not load this quote."));
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50">
      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <div className="flex items-center gap-2 font-bold text-gray-900">
          <Sun className="w-5 h-5 text-orange-500" /> PandaSolution
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!quote && !error && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}

        {quote && (
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <QuoteSummary quote={quote} />
              <Button asChild className="w-full min-h-12">
                <a href={`/api/v1/public/quotes/${token}/pdf`}>
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-gray-700">Want an engineering-correct solar quote for your own home or business?</p>
            <Button asChild variant="outline" className="min-h-11"><Link to="/">Size my system</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SharedQuote;
