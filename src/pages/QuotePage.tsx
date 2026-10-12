import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Download, Link2, Loader2, MessageCircle, AlertTriangle } from "lucide-react";
import QuoteSummary from "@/components/quote/QuoteSummary";
import AdGateModal from "@/components/quote/AdGateModal";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, ApiClientError } from "@/lib/api";
import { downloadPdf, whatsappLink, type QuoteView } from "@/lib/quotes";

type Action = "whatsapp" | "pdf";

const QuotePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gateFor, setGateFor] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<QuoteView>(`/quotes/${id}`)
      .then(setQuote)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Could not load this quote."));
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent(`/quote/${id}`)}`, { replace: true });
      return;
    }
    load();
  }, [authLoading, user, id, load, navigate]);

  const runAction = async (action: Action, shareUrl: string | null) => {
    if (!quote) return;
    if (action === "whatsapp") {
      if (!shareUrl) return toast({ title: "Quote expired", description: "Expired quotes can't be shared.", variant: "destructive" });
      window.open(whatsappLink(quote, shareUrl), "_blank", "noopener");
      return;
    }
    setBusy(true);
    try {
      await downloadPdf(`/quotes/${quote.id}/pdf`, `${quote.reference}.pdf`);
    } catch (err) {
      toast({ title: "Download failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const request = (action: Action) => {
    if (quote?.unlocked) runAction(action, quote.shareUrl ?? null);
    else setGateFor(action);
  };

  const onGateContinue = useCallback(
    (shareUrl: string | null) => {
      const action = gateFor;
      setGateFor(null);
      if (action) runAction(action, shareUrl);
      load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gateFor, quote, load],
  );
  const onGateError = useCallback(
    (message: string) => {
      setGateFor(null);
      toast({ title: "Something went wrong", description: message, variant: "destructive" });
    },
    [toast],
  );

  const copyLink = async () => {
    if (!quote?.shareUrl) return;
    await navigator.clipboard.writeText(quote.shareUrl);
    toast({ title: "Link copied", description: "Anyone with this link can view the quote for 30 days." });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50">
      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 min-h-11">
          <ArrowLeft className="w-4 h-4" /> Back to PandaSolution
        </Link>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!quote && !error && (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        )}

        {quote && (
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <QuoteSummary quote={quote} />

              {quote.status === "expired" ? (
                <Alert>
                  <AlertDescription className="space-y-3">
                    <p>This quote has expired. Prices may have changed — run a new calculation for an up-to-date quote.</p>
                    <Button onClick={() => navigate("/")}>Start a new calculation</Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {/* WhatsApp first: it is how most customers share quotes (PRD §26.1). */}
                  <Button onClick={() => request("whatsapp")} className="w-full min-h-12 bg-green-600 hover:bg-green-700 text-white">
                    <MessageCircle className="w-5 h-5 mr-2" /> Share via WhatsApp
                  </Button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" onClick={() => request("pdf")} disabled={busy} className="min-h-12">
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Download PDF
                    </Button>
                    <Button variant="outline" onClick={quote.shareUrl ? copyLink : () => request("whatsapp")} className="min-h-12">
                      <Link2 className="w-4 h-4 mr-2" /> {quote.shareUrl ? "Copy share link" : "Get share link"}
                    </Button>
                  </div>
                  {!quote.unlocked && (
                    <p className="text-xs text-gray-500 text-center">Free accounts watch a short ad once to unlock downloads and sharing for 24 hours.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {gateFor && quote && (
        <AdGateModal
          quoteId={quote.id}
          actionLabel={gateFor === "whatsapp" ? "Continue to WhatsApp" : "Continue to download"}
          onContinue={onGateContinue}
          onError={onGateError}
        />
      )}
    </div>
  );
};

export default QuotePage;
