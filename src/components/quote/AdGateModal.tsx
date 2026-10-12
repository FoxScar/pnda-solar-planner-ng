import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sun } from "lucide-react";
import { ApiClientError } from "@/lib/api";
import { completeAd, startAd } from "@/lib/quotes";

interface AdGateModalProps {
  quoteId: string;
  actionLabel: string;
  /** Called synchronously from the Continue click so popups (WhatsApp) aren't blocked. */
  onContinue: (shareUrl: string | null) => void;
  onError: (message: string) => void;
}

/**
 * Full-screen ad gate (PRD §31.1). No close or skip during the countdown; the
 * server verifies the elapsed time, so leaving and returning does not bypass it.
 */
const AdGateModal = ({ quoteId, actionLabel, onContinue, onError }: AdGateModalProps) => {
  const [ad, setAd] = useState<{ providerUrl: string | null; durationSeconds: number } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null | undefined>(undefined);
  const eventId = useRef<string | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    startAd(quoteId)
      .then((res) => {
        if (cancelled) return;
        // `in` narrowing works without strictNullChecks (the frontend tsconfig is non-strict).
        if (!("adEventId" in res)) {
          setShareUrl(null);
          setRemaining(0);
          return;
        }
        eventId.current = res.adEventId;
        setAd(res.ad);
        // One extra second so the server-side elapsed-time check always passes.
        setRemaining(res.ad.durationSeconds + 1);
      })
      .catch((err) => onError(err instanceof ApiClientError ? err.message : "Could not load the ad."));
    return () => {
      cancelled = true;
    };
  }, [quoteId, onError]);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => (r ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  useEffect(() => {
    if (remaining !== 0 || !eventId.current || shareUrl !== undefined) return;
    const id = eventId.current;
    const attempt = (tries: number) =>
      completeAd(quoteId, id)
        .then((res) => setShareUrl(res.shareUrl))
        .catch((err) => {
          if (err instanceof ApiClientError && err.code === "AD_INCOMPLETE" && tries < 3) setTimeout(() => attempt(tries + 1), 1500);
          else onError(err instanceof ApiClientError ? err.message : "Could not verify the ad.");
        });
    attempt(0);
  }, [remaining, quoteId, shareUrl, onError]);

  const ready = shareUrl !== undefined;
  useEffect(() => {
    if (ready) continueRef.current?.focus();
  }, [ready]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ad-title" className="fixed inset-0 z-[200] flex flex-col bg-gray-950 p-4">
      <div className="flex items-center justify-between text-white">
        <p id="ad-title" className="text-sm">Sponsored · your quote unlocks after this message</p>
        <span aria-live="polite" className="text-sm tabular-nums">
          {remaining === null ? "" : remaining > 0 ? `${remaining}s` : ready ? "Done" : "Verifying…"}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center py-4">
        {ad?.providerUrl ? (
          <iframe
            src={ad.providerUrl}
            title="Advertisement"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            className="w-full max-w-3xl aspect-video rounded-lg bg-white"
          />
        ) : (
          <div className="w-full max-w-md rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 p-8 text-white text-center space-y-3">
            <Sun className="w-12 h-12 mx-auto" />
            <p className="text-2xl font-bold">Are you a solar installer?</p>
            <p>PandaSolution Pro gives you branded quotes, your own pricing and margins, client history — and no ads.</p>
          </div>
        )}
      </div>

      <Button
        ref={continueRef}
        disabled={!ready}
        onClick={() => onContinue(shareUrl ?? null)}
        className="w-full max-w-md mx-auto min-h-12 bg-white text-gray-900 hover:bg-gray-100"
      >
        {ready ? actionLabel : remaining === null ? <Loader2 className="w-4 h-4 animate-spin" /> : "Please wait…"}
      </Button>
    </div>
  );
};

export default AdGateModal;
