
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Calendar, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

interface SavedQuote {
  id: string;
  quote_data: any;
  appliances_data: any[];
  total_cost: number;
  created_at: string;
}

const SavedQuotes = ({ onBack, onLoadQuote }: { 
  onBack: () => void;
  onLoadQuote: (quoteData: any) => void;
}) => {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchQuotes();
    }
  }, [user]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setQuotes(data || []);
    } catch (err: any) {
      console.error('Error fetching quotes:', err);
      setError('Unable to load your saved quotes. Please try again.');
      toast({
        title: "Error Loading Quotes",
        description: "There was a problem loading your saved quotes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteQuote = async (quoteId: string) => {
    try {
      setDeletingId(quoteId);
      
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) {
        throw error;
      }

      setQuotes(quotes.filter(quote => quote.id !== quoteId));
      toast({
        title: "Quote Deleted",
        description: "Your quote has been successfully deleted.",
      });
    } catch (err: any) {
      console.error('Error deleting quote:', err);
      toast({
        title: "Delete Failed",
        description: "Unable to delete the quote. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
        <CardDescription>
          View and manage your solar system quotes
        </CardDescription>
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
            <p className="text-gray-600 mb-4">
              You haven't saved any solar system quotes yet. Complete a quote to save it for later.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {quotes.map((quote) => (
              <Card key={quote.id} className="border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {formatDate(quote.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="outline">
                          {quote.appliances_data?.length || 0} Appliances
                        </Badge>
                        <Badge className="bg-green-100 text-green-700">
                          {formatPrice(quote.total_cost)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLoadQuote(quote)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteQuote(quote.id)}
                        disabled={deletingId === quote.id}
                        className="text-red-600 hover:text-red-700"
                      >
                        {deletingId === quote.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Appliances:</span>
                      <p className="font-medium">
                        {quote.appliances_data?.slice(0, 2).map(app => app.name).join(', ')}
                        {quote.appliances_data?.length > 2 && ` +${quote.appliances_data.length - 2} more`}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">System Type:</span>
                      <p className="font-medium">
                        {quote.quote_data?.inverter?.model_name?.includes('Hybrid') ? 'Hybrid' : 'Off-Grid'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back to Home
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SavedQuotes;
