import * as React from "react";
import { cn } from "@/lib/utils";

export interface NativeSelectOption {
  value: string;
  label: string;
}

interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: NativeSelectOption[];
  onValueChange: (value: string) => void;
}

/**
 * Styled native <select>. Uses the phone's own picker, which is more reliable
 * on touch screens than a custom popover for short option lists.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(({ className, options, onValueChange, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    onChange={(e) => onValueChange(e.target.value)}
    {...props}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
