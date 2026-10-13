import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Battery, PanelsTopLeft, Zap } from "lucide-react";
import { formatPrice } from "../utils/formatters";
import { STATE_LABEL, type QuoteView } from "@/lib/quotes";

const FLAG_TEXT: Record<string, string> = {
  PRICE_CHANGED: "Some component prices have changed by 5% or more since this quote was generated. Ask for an updated quote before buying.",
  COMPONENT_UNAVAILABLE: "One or more components in this quote are no longer available. Please calculate again.",
};
const fmt = (n: number) => Number(n.toFixed(2)).toString();
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

/** Read-only quote body shared by the owner page and the public share page. */
const QuoteSummary = ({ quote }: { quote: QuoteView }) => {
  const { system, pricing } = quote;
  const leadAcid = system.batteryChemistry !== 'lithium';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-lg">{quote.reference}</p>
          <p className="text-sm text-gray-600">
            {quote.clientName ? `${quote.clientName} · ` : ''}{STATE_LABEL(quote.state)}
            {quote.preparedBy ? ` · Prepared by ${quote.preparedBy}` : ''}
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Issued {formatDate(quote.createdAt)}</p>
          <p>Valid until {formatDate(quote.expiresAt)}</p>
          {quote.status === 'expired' && <Badge variant="destructive" className="mt-1">Expired</Badge>}
        </div>
      </div>

      {quote.flags.map((f) => (
        <Alert key={f} variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{FLAG_TEXT[f] ?? f}</AlertDescription>
        </Alert>
      ))}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <Zap className="w-5 h-5 text-orange-500 mb-2" />
          <p className="font-semibold">{system.inverter.kva}kVA inverter</p>
          <p className="text-sm text-gray-600">{system.inverter.model} · {system.systemVoltage}V</p>
        </div>
        <div className="rounded-lg border p-4">
          <Battery className="w-5 h-5 text-blue-500 mb-2" />
          <p className="font-semibold">{fmt(system.battery.installedKwh)}kWh batteries</p>
          <p className="text-sm text-gray-600">
            {system.battery.units} × {system.battery.model}
            {leadAcid && ` (${system.battery.parallelStrings} × ${system.battery.seriesCount} in series)`}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <PanelsTopLeft className="w-5 h-5 text-yellow-500 mb-2" />
          <p className="font-semibold">{system.panels.count} solar panels</p>
          <p className="text-sm text-gray-600">{system.panels.wattsPeak}W each · {fmt(system.panels.arrayKwp)}kW</p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["cost"]}>
        <AccordionItem value="cost">
          <AccordionTrigger>Cost breakdown · {formatPrice(pricing.totalNgn)}</AccordionTrigger>
          <AccordionContent>
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
                  {pricing.lines.map((l) => (
                    <TableRow key={l.sku}>
                      <TableCell>{l.model}<span className="block text-xs text-gray-500">{formatPrice(l.unitPriceNgn)} each</span></TableCell>
                      <TableCell className="text-right">{l.quantity}</TableCell>
                      <TableCell className="text-right">{formatPrice(l.lineTotalNgn)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow><TableCell colSpan={2}>Equipment</TableCell><TableCell className="text-right">{formatPrice(pricing.equipmentSubtotalNgn)}</TableCell></TableRow>
                  {pricing.installationFeeNgn > 0 && (
                    <TableRow>
                      <TableCell colSpan={2}>Installation ({Number((pricing.installationRate * 100).toFixed(2))}%)</TableCell>
                      <TableCell className="text-right">{formatPrice(pricing.installationFeeNgn)}</TableCell>
                    </TableRow>
                  )}
                  {pricing.labourNgn > 0 && (
                    <TableRow><TableCell colSpan={2}>Other fees</TableCell><TableCell className="text-right">{formatPrice(pricing.labourNgn)}</TableCell></TableRow>
                  )}
                  {pricing.discountNgn > 0 && (
                    <TableRow><TableCell colSpan={2}>Discount</TableCell><TableCell className="text-right">−{formatPrice(pricing.discountNgn)}</TableCell></TableRow>
                  )}
                  {pricing.vatRate > 0 && (
                    <TableRow><TableCell colSpan={2}>VAT ({Number((pricing.vatRate * 100).toFixed(2))}%)</TableCell><TableCell className="text-right">{formatPrice(pricing.vatNgn)}</TableCell></TableRow>
                  )}
                  <TableRow><TableCell colSpan={2} className="font-bold">Total</TableCell><TableCell className="text-right font-bold">{formatPrice(pricing.totalNgn)}</TableCell></TableRow>
                </TableFooter>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="appliances">
          <AccordionTrigger>Appliances ({quote.appliances.length})</AccordionTrigger>
          <AccordionContent>
            <ul className="divide-y text-sm">
              {quote.appliances.map((a, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span>{a.quantity} × {a.name}</span>
                  <span className="text-gray-600">{fmt(a.dayHours)}h day · {fmt(a.nightHours)}h night</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p className="text-xs text-gray-500">
        Sized for the appliances and hours listed, using rainy-season sunshine for this state. Accuracy depends on that information being correct.
      </p>
    </div>
  );
};

export default QuoteSummary;
