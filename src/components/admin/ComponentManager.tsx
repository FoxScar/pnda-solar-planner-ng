import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, SlidersHorizontal, X } from "lucide-react";
import ComponentSpecEditor from "./ComponentSpecEditor";
import type { BatteryChemistry, ComponentType } from "../../../shared/domain";
import { api } from "@/lib/api";
import { formatPrice } from "../utils/formatters";
import { useAdminAction } from "./useAdminToast";

interface Component {
  id: string;
  sku: string;
  type: ComponentType;
  brand: string;
  model: string;
  kva: number | null;
  dcVoltage: number | null;
  chemistry: BatteryChemistry | null;
  capacityKwh: number | null;
  capacityAh: number | null;
  wattsPeak: number | null;
  unitPriceNgn: number;
  isActive: boolean;
  [spec: string]: unknown;
}

const EMPTY_FORM = {
  type: "inverter" as ComponentType,
  sku: "",
  brand: "Felicity",
  model: "",
  unitPriceNgn: "",
  kva: "",
  dcVoltage: "48",
  chemistry: "lithium" as BatteryChemistry,
  capacityKwh: "",
  capacityAh: "",
  wattsPeak: "",
};

function specLabel(c: Component): string {
  if (c.type === "inverter") return `${c.kva}kVA · ${c.dcVoltage}V`;
  if (c.type === "battery") return `${c.chemistry} · ${c.dcVoltage}V · ${c.capacityKwh}kWh${c.capacityAh ? ` (${c.capacityAh}Ah)` : ""}`;
  return `${c.wattsPeak}Wp`;
}

function buildCreatePayload(f: typeof EMPTY_FORM) {
  const base = { type: f.type, sku: f.sku, brand: f.brand, model: f.model, unitPriceNgn: Number(f.unitPriceNgn) };
  if (f.type === "inverter") return { ...base, kva: Number(f.kva), dcVoltage: Number(f.dcVoltage) };
  if (f.type === "battery") {
    return {
      ...base,
      chemistry: f.chemistry,
      dcVoltage: Number(f.dcVoltage),
      capacityKwh: Number(f.capacityKwh),
      capacityAh: f.capacityAh ? Number(f.capacityAh) : null,
    };
  }
  return { ...base, wattsPeak: Number(f.wattsPeak) };
}

const ComponentManager = () => {
  const [items, setItems] = useState<Component[]>([]);
  const [filter, setFilter] = useState<ComponentType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [specsFor, setSpecsFor] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const run = useAdminAction();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api<Component[]>("/admin/components"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, body: Partial<Component>, message: string) => {
    const updated = await run(() => api<Component>(`/admin/components/${id}`, { method: "PATCH", json: body }), message);
    if (updated) setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const savePrice = async (c: Component) => {
    const draft = priceDrafts[c.id];
    if (draft === undefined) return;
    await patch(c.id, { unitPriceNgn: Number(draft) }, `${c.model} price updated`);
    setPriceDrafts(({ [c.id]: _, ...rest }) => rest);
  };

  const create = async () => {
    const created = await run(
      () => api<Component>("/admin/components", { method: "POST", json: buildCreatePayload(form) }),
      "Component added",
    );
    if (created) {
      setItems((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    }
  };

  const set = (field: keyof typeof EMPTY_FORM, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const visible = filter === "all" ? items : items.filter((c) => c.type === filter);

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="px-0 sm:px-6 flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Component Inventory</CardTitle>
        <div className="flex gap-2">
          <NativeSelect value={filter} onValueChange={(v) => setFilter(v as ComponentType | "all")} className="w-36" options={[{ value: "all", label: "All types" }, { value: "inverter", label: "Inverters" }, { value: "battery", label: "Batteries" }, { value: "panel", label: "Panels" }]} />
          <Button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6 space-y-4">
        {showForm && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border rounded-lg bg-gray-50">
            <div>
              <Label>Type</Label>
              <NativeSelect value={form.type} onValueChange={(v) => set("type", v)} options={[{ value: "inverter", label: "Inverter" }, { value: "battery", label: "Battery" }, { value: "panel", label: "Panel" }]} />
            </div>
            <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="INV-FEL-5K-48" /></div>
            <div><Label>Brand</Label><Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => set("model", e.target.value)} /></div>
            <div><Label>Unit price (₦)</Label><Input type="number" min="1" value={form.unitPriceNgn} onChange={(e) => set("unitPriceNgn", e.target.value)} /></div>
            {form.type === "inverter" && (
              <>
                <div><Label>kVA (max 12)</Label><Input type="number" step="0.1" max="12" value={form.kva} onChange={(e) => set("kva", e.target.value)} /></div>
                <div>
                  <Label>DC voltage</Label>
                  <NativeSelect value={form.dcVoltage} onValueChange={(v) => set("dcVoltage", v)} options={[{ value: "24", label: "24V" }, { value: "48", label: "48V" }]} />
                </div>
              </>
            )}
            {form.type === "battery" && (
              <>
                <div>
                  <Label>Chemistry</Label>
                  <NativeSelect value={form.chemistry} onValueChange={(v) => set("chemistry", v)} options={[{ value: "lithium", label: "Lithium (LiFePO4)" }, { value: "gel", label: "Gel lead-acid" }, { value: "tubular", label: "Tubular lead-acid" }]} />
                </div>
                <div>
                  <Label>Nominal voltage</Label>
                  <NativeSelect value={form.dcVoltage} onValueChange={(v) => set("dcVoltage", v)} options={[{ value: "12", label: "12V" }, { value: "24", label: "24V" }, { value: "48", label: "48V" }]} />
                </div>
                <div><Label>Capacity (kWh)</Label><Input type="number" step="0.01" value={form.capacityKwh} onChange={(e) => set("capacityKwh", e.target.value)} /></div>
                <div><Label>Capacity (Ah, optional)</Label><Input type="number" value={form.capacityAh} onChange={(e) => set("capacityAh", e.target.value)} /></div>
              </>
            )}
            {form.type === "panel" && (
              <div><Label>Rated power (Wp)</Label><Input type="number" value={form.wattsPeak} onChange={(e) => set("wattsPeak", e.target.value)} /></div>
            )}
            <div className="sm:col-span-3">
              <Button onClick={create} className="flex items-center gap-2"><Save className="w-4 h-4" />Save component</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : (
          <>
          {/* Phones: one card per product so price, stock and specs are all visible without side-scrolling. */}
          <ul className="space-y-3 md:hidden">
            {visible.map((c) => {
              const priceDirty = priceDrafts[c.id] !== undefined && Number(priceDrafts[c.id]) !== c.unitPriceNgn;
              return (
                <li key={c.id} className="rounded-lg border bg-white p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{c.model}</p>
                      <p className="font-mono text-xs text-gray-500">{c.sku}</p>
                      <p className="text-sm text-gray-600 capitalize">{specLabel(c)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize">{c.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">₦</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      className="h-11 flex-1"
                      aria-label={`Price for ${c.model}`}
                      value={priceDrafts[c.id] ?? String(c.unitPriceNgn)}
                      onChange={(e) => setPriceDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    />
                    {priceDirty && <Button className="h-11" onClick={() => savePrice(c)}>Save</Button>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <Switch
                        checked={c.isActive}
                        onCheckedChange={(checked) => patch(c.id, { isActive: checked }, `${c.model} ${checked ? "activated" : "marked out of stock"}`)}
                      />
                      {c.isActive ? "In stock" : "Out of stock"}
                    </label>
                    <Button variant="outline" className="h-11" onClick={() => setSpecsFor((id) => (id === c.id ? null : c.id))} aria-expanded={specsFor === c.id}>
                      <SlidersHorizontal className="mr-2 h-4 w-4" /> Specs
                    </Button>
                  </div>
                  {specsFor === c.id && (
                    <ComponentSpecEditor
                      type={c.type}
                      values={c as unknown as Record<string, number | null>}
                      onSave={(specPatch) => patch(c.id, specPatch as Partial<Component>, `${c.model} specs updated`)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Spec</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead><span className="sr-only">Specs</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => (
                  <Fragment key={c.id}>
                  <TableRow>
                    <TableCell className="font-mono text-xs">{c.sku}</TableCell>
                    <TableCell>
                      {c.model} <Badge variant="outline" className="ml-1 capitalize">{c.type}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{specLabel(c)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          className="w-32"
                          aria-label={`Price for ${c.model}`}
                          value={priceDrafts[c.id] ?? String(c.unitPriceNgn)}
                          onChange={(e) => setPriceDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                        />
                        {priceDrafts[c.id] !== undefined && Number(priceDrafts[c.id]) !== c.unitPriceNgn ? (
                          <Button size="sm" onClick={() => savePrice(c)} aria-label="Save price"><Save className="w-4 h-4" /></Button>
                        ) : (
                          <span className="text-xs text-gray-500 hidden md:inline">{formatPrice(c.unitPriceNgn)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.isActive}
                        aria-label={`${c.model} available`}
                        onCheckedChange={(checked) => patch(c.id, { isActive: checked }, `${c.model} ${checked ? "activated" : "marked out of stock"}`)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={specsFor === c.id ? "secondary" : "ghost"}
                        onClick={() => setSpecsFor((id) => (id === c.id ? null : c.id))}
                        aria-expanded={specsFor === c.id}
                        aria-label={`Datasheet specs for ${c.model}`}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {specsFor === c.id && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <ComponentSpecEditor
                          type={c.type}
                          values={c as unknown as Record<string, number | null>}
                          onSave={(specPatch) => patch(c.id, specPatch as Partial<Component>, `${c.model} specs updated`)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ComponentManager;
