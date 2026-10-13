import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Info } from "lucide-react";
import type { BatteryChemistry } from '../../shared/domain';
import { api } from '@/lib/api';

export interface LocationData {
  state: string;
  batteryChemistry: BatteryChemistry;
  /** null = let the engine pick the best-value panel. */
  panelId: string | null;
}

interface PanelOption {
  id: string;
  brand: string;
  model: string;
  wattsPeak: number;
  performanceFactor: number;
}

const BEST_VALUE = 'best';

const CHEMISTRY_OPTIONS: { value: BatteryChemistry; label: string; description: string }[] = [
  { value: 'lithium', label: 'Lithium (recommended)', description: 'Lasts 10+ years, no maintenance, smaller and lighter.' },
  { value: 'tubular', label: 'Tubular', description: 'Lower upfront cost, needs regular water top-ups, 3–5 year life.' },
  { value: 'gel', label: 'Gel', description: 'Lower upfront cost, maintenance-free, 3–5 year life.' },
];

const LocationStep = ({ onNext, onBack, data }) => {
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState<string>(data?.location?.state ?? '');
  const [chemistry, setChemistry] = useState<BatteryChemistry>(data?.location?.batteryChemistry ?? 'lithium');
  const [panels, setPanels] = useState<PanelOption[]>([]);
  const [panelId, setPanelId] = useState<string>(data?.location?.panelId ?? BEST_VALUE);
  const hasAirConditioner = (data?.appliances ?? []).some((a) => a.category === 'Air Conditioning');

  useEffect(() => {
    api<{ state: string }[]>('/sun-hours').then((rows) => setStates(rows.map((r) => r.state)));
    api<PanelOption[]>('/panels')
      .then((rows) => {
        setPanels(rows);
        // A previously chosen panel may have been withdrawn.
        setPanelId((id) => (id === BEST_VALUE || rows.some((p) => p.id === id) ? id : BEST_VALUE));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (hasAirConditioner) setChemistry('lithium');
  }, [hasAirConditioner]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-500" />
          Where Will It Be Installed?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger id="state"><SelectValue placeholder="Select your state" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {states.map((s) => <SelectItem key={s} value={s}>{s === 'FCT' ? 'FCT (Abuja)' : s}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-600">Sunshine varies across Nigeria, so your state changes how many panels you need.</p>
        </div>

        <div className="space-y-3">
          <Label>Battery type</Label>
          {hasAirConditioner && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Air conditioners draw heavy current that wears out gel and tubular batteries quickly, so systems with an AC use lithium.
              </AlertDescription>
            </Alert>
          )}
          <RadioGroup value={chemistry} onValueChange={(v) => setChemistry(v as BatteryChemistry)} className="space-y-2">
            {CHEMISTRY_OPTIONS.map((opt) => {
              const disabled = hasAirConditioner && opt.value !== 'lithium';
              return (
                <Label
                  key={opt.value}
                  htmlFor={`chem-${opt.value}`}
                  className={`flex items-start gap-3 rounded-lg border p-4 min-h-11 cursor-pointer ${chemistry === opt.value ? 'border-orange-500 bg-orange-50' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RadioGroupItem id={`chem-${opt.value}`} value={opt.value} disabled={disabled} className="mt-1" />
                  <span>
                    <span className="font-medium block">{opt.label}</span>
                    <span className="text-sm text-gray-600 font-normal">{opt.description}</span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
        </div>

        {panels.length > 1 && (
          <div className="space-y-3">
            <Label>Solar panels</Label>
            <RadioGroup value={panelId} onValueChange={setPanelId} className="space-y-2">
              {[{ id: BEST_VALUE, title: 'Best value (recommended)', detail: 'We pick the panel that gives the lowest-cost system for you.' },
                ...panels.map((p) => ({
                  id: p.id,
                  title: p.model,
                  detail: `${p.wattsPeak}W · ${Math.round(p.performanceFactor * 100)}% efficiency`,
                }))].map((opt) => (
                <Label
                  key={opt.id}
                  htmlFor={`panel-${opt.id}`}
                  className={`flex items-start gap-3 rounded-lg border p-4 min-h-11 cursor-pointer ${panelId === opt.id ? 'border-orange-500 bg-orange-50' : ''}`}
                >
                  <RadioGroupItem id={`panel-${opt.id}`} value={opt.id} className="mt-1" />
                  <span>
                    <span className="font-medium block">{opt.title}</span>
                    <span className="text-sm text-gray-600 font-normal">{opt.detail}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <p className="text-sm text-gray-600">Lower-efficiency panels produce less power, so you'll need more of them.</p>
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
          <Button
            onClick={() => onNext({ location: { state, batteryChemistry: chemistry, panelId: panelId === BEST_VALUE ? null : panelId } })}
            disabled={!state}
            className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
          >
            See My System
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationStep;
