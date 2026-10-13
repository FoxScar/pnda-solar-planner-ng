import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import type { ComponentType } from "../../../shared/domain";

interface SpecField {
  key: string;
  label: string;
  hint: string;
  step: string;
  /** Fractions are entered as percentages for readability. */
  percent?: boolean;
}

/** Manufacturer datasheet values used by the sizing engine (Developer Calculation Schematics). */
const FIELDS: Record<ComponentType, SpecField[]> = {
  inverter: [
    { key: "continuousW", label: "Continuous output (W)", hint: "Blank = kVA × power factor", step: "1" },
    { key: "surgeW", label: "Surge output (W)", hint: "Blank = continuous × surge multiplier", step: "1" },
    { key: "efficiency", label: "Efficiency (%)", hint: "Blank = settings default", step: "0.1", percent: true },
    { key: "maxPvInputW", label: "Max PV input (W)", hint: "Needed for the PV input check", step: "1" },
    { key: "maxPvVoc", label: "Max PV voltage (V)", hint: "MPPT max open-circuit voltage", step: "0.1" },
    { key: "maxPvIsc", label: "Max PV current per MPPT (A)", hint: "MPPT max input current", step: "0.1" },
    { key: "mpptCount", label: "MPPT inputs", hint: "Blank = 1", step: "1" },
  ],
  battery: [
    { key: "depthOfDischarge", label: "Usable depth of discharge (%)", hint: "Blank = chemistry default", step: "0.1", percent: true },
    { key: "dischargeEfficiency", label: "Discharge efficiency (%)", hint: "Blank = chemistry default", step: "0.1", percent: true },
    { key: "maxDischargeW", label: "Max continuous discharge (W)", hint: "Per unit; blank = not checked", step: "1" },
  ],
  panel: [
    { key: "performanceFactor", label: "Performance factor (%)", hint: "Usable output vs nameplate, losses included", step: "0.1", percent: true },
    { key: "voc", label: "Open-circuit voltage Voc (V)", hint: "For string sizing", step: "0.01" },
    { key: "isc", label: "Short-circuit current Isc (A)", hint: "For string sizing", step: "0.01" },
  ],
};

interface Props {
  type: ComponentType;
  values: Record<string, number | null>;
  onSave: (patch: Record<string, number | null>) => Promise<void>;
}

const ComponentSpecEditor = ({ type, values, onSave }: Props) => {
  const fields = FIELDS[type];
  const toDisplay = (f: SpecField) => {
    const v = values[f.key];
    if (v === null || v === undefined) return "";
    return String(f.percent ? Number((v * 100).toFixed(4)) : v);
  };
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, toDisplay(f)])));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const patch: Record<string, number | null> = {};
    for (const f of fields) {
      const raw = drafts[f.key]?.trim() ?? "";
      if (raw === toDisplay(f)) continue;
      // Performance factor is required for panels, so it can't be blanked.
      if (raw === "" && !(type === "panel" && f.key === "performanceFactor")) patch[f.key] = null;
      else if (raw !== "") patch[f.key] = f.percent ? Number(raw) / 100 : Number(raw);
    }
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    try {
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-3 p-3 bg-gray-50 rounded-lg">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label htmlFor={`spec-${f.key}`} className="text-xs">{f.label}</Label>
          <Input
            id={`spec-${f.key}`}
            type="number"
            step={f.step}
            min="0"
            value={drafts[f.key] ?? ""}
            placeholder="Not on record"
            onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
          />
          <p className="text-xs text-gray-500">{f.hint}</p>
        </div>
      ))}
      <div className="sm:col-span-3">
        <Button size="sm" onClick={save} disabled={saving} className="flex items-center gap-2">
          <Save className="w-4 h-4" /> Save specs
        </Button>
      </div>
    </div>
  );
};

export default ComponentSpecEditor;
