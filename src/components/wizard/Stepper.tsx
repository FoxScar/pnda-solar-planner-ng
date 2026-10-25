import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface StepperProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Show a slider under the −/+ controls (PRD §26.1: sliders, not number keyboards, for hours). */
  slider?: boolean;
  onChange: (value: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Touch-friendly number input: 44px −/+ buttons, the value in the middle, optional slider. */
const Stepper = ({ id, label, hint, value, min, max, step, unit, slider = false, onChange }: StepperProps) => {
  const set = (v: number) => onChange(clamp(Math.round(v / step) * step, min, max));
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium leading-none">{label}</label>
        {hint && <span className="text-xs text-gray-500 text-right">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Decrease ${label}`}>
          <Minus className="h-4 w-4" />
        </Button>
        <output id={id} aria-live="polite" className="flex-1 text-center text-lg font-semibold tabular-nums">
          {fmt(value)}{unit ? <span className="ml-1 text-sm font-normal text-gray-600">{unit}</span> : null}
        </output>
        <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => set(value + step)} disabled={value >= max} aria-label={`Increase ${label}`}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {slider && (
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => set(v ?? min)}
          aria-label={label}
          className="py-3 [&_[role=slider]]:h-7 [&_[role=slider]]:w-7"
        />
      )}
    </div>
  );
};

export default Stepper;
