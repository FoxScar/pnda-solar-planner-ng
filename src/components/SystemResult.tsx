import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Battery, FileText, Info, Loader2, PanelsTopLeft, Sun, Zap } from "lucide-react";
import { api, ApiClientError } from '@/lib/api';
import { formatPrice } from './utils/formatters';

interface CalculationResponse {
  calculationId: string;
  state: string;
  system: {
    systemVoltage: number;
    batteryChemistry: string;
    inverter: { model: string; kva: number };
    battery: { model: string; units: number; seriesCount: number; parallelStrings: number; installedKwh: number };
    panels: { model: string; wattsPeak: number; count: number; arrayKwp: number };
  };
  bom: { sku: string; type: string; model: string; quantity: number; unitPriceNgn: number }[];
  pricing: { equipmentSubtotalNgn: number; vatNgn: number; totalNgn: number; vatRate: number };
  warnings: { code: string; message: string }[];
  calculation?: unknown;
}

/** Warnings that only make sense to engineers reviewing the design. */
const TECHNICAL_WARNINGS = new Set(['PV_INPUT_UNVERIFIED']);

const fmt = (n: number) => Number(n.toFixed(2)).toString();

const SystemResult = ({ onBack, data }) => {
  const [result, setResult] = useState<CalculationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const saveQuote = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const quote = await api<{ id: string }>('/quotes', {
        method: 'POST',
        json: { calculationId: result.calculationId, clientName: clientName || undefined },
      });
      navigate(`/quote/${quote.id}`);
    } catch (err) {
      toast({ title: "Couldn't save quote", description: err instanceof ApiClientError ? err.message : 'Please try again.', variant: 'destructive' });
      setSaving(false);
    }
  };

  useEffect(() => {
    const body = {
      state: data.location?.state,
      batteryChemistry: data.location?.batteryChemistry ?? 'lithium',
      appliances: (data.appliances ?? []).map((a) => ({
        applianceId: a.applianceId,
        quantity: a.quantity,
        dayHours: a.dayHours,
        nightHours: a.nightHours,
      })),
    };
    setLoading(true);
    setError(null);
    api<CalculationResponse>('/calculate', { method: 'POST', json: body })
      .then(setResult)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : "We couldn't calculate your system. Please check your appliance list and try again."),
      )
      .finally(() => setLoading(false));
  }, [data.appliances, data.location]);

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-600">Designing your system…</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !result) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={onBack} className="w-full">Back</Button>
        </CardContent>
      </Card>
    );
  }

  const { system, pricing } = result;
  const isLeadAcid = system.batteryChemistry !== 'lithium';
  const warnings = result.warnings.filter((w) => result.calculation || !TECHNICAL_WARNINGS.has(w.code));

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-orange-500" />
          Your Recommended System
        </CardTitle>
        <p className="text-gray-600">Designed for {result.state === 'FCT' ? 'Abuja (FCT)' : result.state}, sized for rainy-season sunshine so it works all year.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <Zap className="w-5 h-5 text-orange-500 mb-2" />
            <p className="font-semibold">{system.inverter.kva}kVA inverter</p>
            <p className="text-sm text-gray-600">{system.inverter.model} · {system.systemVoltage}V system</p>
          </div>
          <div className="rounded-lg border p-4">
            <Battery className="w-5 h-5 text-blue-500 mb-2" />
            <p className="font-semibold">{fmt(system.battery.installedKwh)}kWh battery bank</p>
            <p className="text-sm text-gray-600">
              {system.battery.units} × {system.battery.model}
              {isLeadAcid && ` (${system.battery.parallelStrings} string${system.battery.parallelStrings > 1 ? 's' : ''} of ${system.battery.seriesCount})`}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <PanelsTopLeft className="w-5 h-5 text-yellow-500 mb-2" />
            <p className="font-semibold">{system.panels.count} solar panels</p>
            <p className="text-sm text-gray-600">{system.panels.wattsPeak}W each · {fmt(system.panels.arrayKwp)}kW total</p>
          </div>
        </div>

        {warnings.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-1">{warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.bom.map((line) => (
                <TableRow key={line.sku}>
                  <TableCell>{line.model}<span className="block text-xs text-gray-500">{formatPrice(line.unitPriceNgn)} each</span></TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{formatPrice(line.quantity * line.unitPriceNgn)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Equipment subtotal</TableCell>
                <TableCell className="text-right">{formatPrice(pricing.equipmentSubtotalNgn)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>VAT ({pricing.vatRate * 100}%)</TableCell>
                <TableCell className="text-right">{formatPrice(pricing.vatNgn)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">Estimated total</TableCell>
                <TableCell className="text-right font-bold">{formatPrice(pricing.totalNgn)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <p className="text-xs text-gray-500">
          Equipment prices only — installation labour is quoted by your installer. Accuracy depends on the appliances and hours you entered.
        </p>

        <div className="rounded-lg border bg-orange-50/50 p-4 space-y-3">
          <p className="font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-orange-500" />Get your quote</p>
          {user ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="client-name">Name on the quote (optional)</Label>
                <Input id="client-name" value={clientName} maxLength={80} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Mrs Adaeze Okafor" />
              </div>
              <Button onClick={saveQuote} disabled={saving} className="w-full min-h-12 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save quote — PDF & WhatsApp'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">Create a free account to save this quote, download the PDF and share it on WhatsApp.</p>
              <Button onClick={() => navigate('/auth?next=/')} className="w-full min-h-12">Sign in to save your quote</Button>
            </>
          )}
        </div>

        <Button variant="outline" onClick={onBack} className="w-full">Change Location or Battery</Button>
      </CardContent>
    </Card>
  );
};

export default SystemResult;
