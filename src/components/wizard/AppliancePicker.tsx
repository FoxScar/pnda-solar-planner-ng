import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

export interface CatalogueAppliance {
  id: string;
  name: string;
  category: string;
}

interface AppliancePickerProps {
  id: string;
  appliances: CatalogueAppliance[];
  value: string | null;
  onSelect: (appliance: CatalogueAppliance) => void;
}

/**
 * Searchable appliance chooser in a bottom sheet (PRD §26.1: bottom sheets,
 * 44px tap targets). A plain dropdown of 70+ items is unusable on a phone.
 */
const AppliancePicker = ({ id, appliances, value, onSelect }: AppliancePickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = appliances.find((a) => a.id === value);
  const categories = [...new Set(appliances.map((a) => a.category))];

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-h-12 justify-between text-left font-normal"
        >
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected?.name ?? "Choose appliance"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Choose an appliance</DrawerTitle>
          <DrawerDescription>Search or browse by category.</DrawerDescription>
        </DrawerHeader>
        {/* Match every typed word as a substring; cmdk's default fuzzy match turns "fan" into "Coffee Maker". */}
        <Command
          className="px-2 pb-4"
          filter={(value, search) => (search.toLowerCase().split(/\s+/).every((w) => value.toLowerCase().includes(w)) ? 1 : 0)}
        >
          <CommandInput placeholder="Search, e.g. fan, fridge, AC…" className="h-12 text-base" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No appliance matches that search.</CommandEmpty>
            {categories.map((category) => (
              <CommandGroup key={category} heading={category}>
                {appliances
                  .filter((a) => a.category === category)
                  .map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`${a.name} ${a.category}`}
                      onSelect={() => {
                        onSelect(a);
                        setOpen(false);
                      }}
                      className="min-h-11 text-base"
                    >
                      <Check className={`mr-2 h-4 w-4 ${a.id === value ? "opacity-100" : "opacity-0"}`} />
                      {a.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DrawerContent>
    </Drawer>
  );
};

export default AppliancePicker;
