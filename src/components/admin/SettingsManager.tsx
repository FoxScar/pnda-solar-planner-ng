import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";
import type { EngineSettings, PricingSettings } from "../../../shared/settings";
import { api } from "@/lib/api";
import { useAdminAction } from "./useAdminToast";

interface AllSettings {
  engine: EngineSettings;
  pricing: PricingSettings;
}

/** Percent input for a 0–1 fraction. */
const Percent = ({ id, label, hint, value, onChange }: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void }) => (
  <div className="space-y-1">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type="number" step="0.1" min="0" value={Number((value * 100).toFixed(4))} onChange={(e) => onChange(Number(e.target.value) / 100)} />
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
);

/** Engineering and pricing parameters (Developer Calculation Schematics). Changes are audited. */
const SettingsManager = () => {
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const run = useAdminAction();

  useEffect(() => {
    api<AllSettings>("/admin/settings").then(setSettings);
  }, []);

  if (!settings) return <p className="text-gray-600">Loading…</p>;
  const { engine, pricing } = settings;
  const setEngine = (patch: Partial<EngineSettings>) => setSettings({ ...settings, engine: { ...engine, ...patch } });
  const setPricing = (patch: Partial<PricingSettings>) => setSettings({ ...settings, pricing: { ...pricing, ...patch } });
  const setChem = (chem: keyof EngineSettings["chemistryDefaults"], key: "depthOfDischarge" | "dischargeEfficiency", v: number) =>
    setEngine({ chemistryDefaults: { ...engine.chemistryDefaults, [chem]: { ...engine.chemistryDefaults[chem], [key]: v } } });

  const save = async () => {
    setSaving(true);
    const updated = await run(() => api<AllSettings>("/admin/settings", { method: "PATCH", json: settings }), "Settings saved. New calculations use them immediately.");
    if (updated) setSettings(updated);
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculation Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-gray-600">
          Defaults follow the Developer Calculation Schematics. Values on a product's datasheet specs always take precedence over these defaults.
        </p>

        <section className="space-y-3">
          <h3 className="font-semibold">Load and inverter</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="night-start">Night starts</Label>
              <Input id="night-start" type="time" value={engine.nightStart} onChange={(e) => setEngine({ nightStart: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="night-end">Night ends</Label>
              <Input id="night-end" type="time" value={engine.nightEnd} onChange={(e) => setEngine({ nightEnd: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf">Power factor</Label>
              <Input id="pf" type="number" step="0.01" min="0.1" max="1" value={engine.powerFactor} onChange={(e) => setEngine({ powerFactor: Number(e.target.value) })} />
              <p className="text-xs text-gray-500">Required VA = peak watts ÷ power factor</p>
            </div>
            <Percent id="inv-eff" label="Default inverter efficiency (%)" value={engine.defaultInverterEfficiency} onChange={(v) => setEngine({ defaultInverterEfficiency: v })} />
            <div className="space-y-1">
              <Label htmlFor="surge-mult">Default surge multiplier</Label>
              <Input id="surge-mult" type="number" step="0.1" min="1" value={engine.defaultInverterSurgeMultiplier} onChange={(e) => setEngine({ defaultInverterSurgeMultiplier: Number(e.target.value) })} />
              <p className="text-xs text-gray-500">Surge = continuous × this, when not on the datasheet</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Batteries</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Percent id="margin" label="Safety margin (%)" value={engine.safetyMargin} onChange={(v) => setEngine({ safetyMargin: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["lithium", "gel", "tubular"] as const).map((chem) => (
              <div key={chem} className="space-y-2 rounded-lg border p-3">
                <p className="font-medium capitalize">{chem} defaults</p>
                <Percent id={`${chem}-dod`} label="Depth of discharge (%)" value={engine.chemistryDefaults[chem].depthOfDischarge} onChange={(v) => setChem(chem, "depthOfDischarge", v)} />
                <Percent id={`${chem}-eff`} label="Discharge efficiency (%)" value={engine.chemistryDefaults[chem].dischargeEfficiency} onChange={(v) => setChem(chem, "dischargeEfficiency", v)} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Solar panels</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Sun hours used for sizing</Label>
              <Select value={engine.sunHoursBasis} onValueChange={(v) => setEngine({ sunHoursBasis: v as EngineSettings["sunHoursBasis"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wet">Wet season (works all year)</SelectItem>
                  <SelectItem value="annual">Annual average</SelectItem>
                  <SelectItem value="dry">Dry season</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-3 pt-6">
              <Switch id="pv-strict" checked={engine.requireVerifiedPvLimits} onCheckedChange={(v) => setEngine({ requireVerifiedPvLimits: v })} />
              <Label htmlFor="pv-strict" className="font-normal">
                Only issue quotes when the inverter's PV input limits are on record
                <span className="block text-xs text-gray-500">Turn on once every inverter has its PV specs entered.</span>
              </Label>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Quotation</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Percent id="install" label="Installation fee (% of subtotal)" value={pricing.installationRate} onChange={(v) => setPricing({ installationRate: v })} />
            <Percent id="vat" label="VAT (%)" hint="Set 0 to leave VAT off quotes" value={pricing.vatRate} onChange={(v) => setPricing({ vatRate: v })} />
          </div>
        </section>

        <Button onClick={save} disabled={saving} className="flex items-center gap-2">
          <Save className="w-4 h-4" /> Save settings
        </Button>
      </CardContent>
    </Card>
  );
};

export default SettingsManager;
