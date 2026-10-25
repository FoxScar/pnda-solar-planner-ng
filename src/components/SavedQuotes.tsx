import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Calendar, AlertTriangle, Loader2, MapPin } from "lucide-react";
import type { QuoteStatus } from '../../shared/domain';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiClientError } from '@/lib/api';
import { formatPrice } from './utils/formatters';

interface QuoteSummary {
  id: string;
  reference: string;
  clientName: string | null;
  state: string;
  status: QuoteStatus;
  flags: string[];
  totalCostNgn: number;
  createdAt: string;
  expiresAt: string;
}

interface QuotePage {
  items: QuoteSummary[];
  page: number;
  pageSize: number;
  total: number;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

const SavedQuotes = ({ onBack }: { onBack: () => void }) => {
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api<QuotePage>('/quotes')
      .then((page) => setQuotes(page.items))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load your quotes.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-600">Loading your quotes...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-500" />
          Your Saved Quotes
        </CardTitle>
        <CardDescription>Quotes stay valid for 30 days from the date they were generated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {quotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved Quotes</h3>
            <p className="text-gray-600 mb-4">Quotes you generate will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {quotes.map((quote) => (
              <Card
                key={quote.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/quote/${quote.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/quote/${quote.id}`)}
                className="border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <CardContent className="p-4 sm:p-6 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{quote.reference}</span>
                    <Badge className="bg-green-100 text-green-700">{formatPrice(quote.totalCostNgn)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" /> {formatDate(quote.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {quote.state}
                    </span>
                    <Badge variant="outline" className="capitalize">{quote.status}</Badge>
                    {quote.flags.map((flag) => (
                      <Badge key={flag} variant="destructive">{flag.replace(/_/g, ' ').toLowerCase()}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={onBack} className="w-full">
          Back to Home
        </Button>
      </CardContent>
    </Card>
  );
};

export default SavedQuotes;
