import { api } from './api';

export interface QuoteView {
  id: string;
  reference: string;
  clientName: string | null;
  state: string;
  status: 'draft' | 'generated' | 'viewed' | 'expired';
  flags: string[];
  createdAt: string;
  expiresAt: string;
  preparedBy: string | null;
  system: {
    systemVoltage: number;
    batteryChemistry: string;
    inverter: { model: string; kva: number };
    battery: { model: string; units: number; seriesCount: number; parallelStrings: number; installedKwh: number };
    panels: { model: string; wattsPeak: number; count: number; arrayKwp: number };
  };
  appliances: { name: string; quantity: number; dayHours: number; nightHours: number }[];
  pricing: {
    lines: { sku: string; type: string; model: string; quantity: number; unitPriceNgn: number; lineTotalNgn: number }[];
    equipmentSubtotalNgn: number;
    labourNgn: number;
    vatNgn: number;
    vatRate: number;
    totalNgn: number;
  };
  unlocked?: boolean;
  shareUrl?: string | null;
}

export type AdStart =
  | { unlocked: true }
  | { unlocked: false; adEventId: string; ad: { id: string | null; providerUrl: string | null; durationSeconds: number } };

export const startAd = (quoteId: string) => api<AdStart>(`/quotes/${quoteId}/ad/start`, { method: 'POST' });
export const completeAd = (quoteId: string, adEventId: string) =>
  api<{ unlocked: true; shareUrl: string | null }>(`/quotes/${quoteId}/ad/complete`, { method: 'POST', json: { adEventId } });

/** PRD §29.2 pre-filled message. */
export function whatsappLink(quote: QuoteView, shareUrl: string): string {
  const from = quote.preparedBy ?? 'PandaSolution';
  const until = new Date(quote.expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  const text = `Here is your solar system quote from ${from}: ${shareUrl}. Valid until ${until}.`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Downloads a PDF through fetch so API errors (ad gate, expiry) surface instead of a broken file. */
export async function downloadPdf(path: string, filename: string): Promise<void> {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? 'Could not download the PDF.');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const STATE_LABEL = (state: string) => (state === 'FCT' ? 'Abuja (FCT)' : state);
