import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAdminAction } from "./useAdminToast";

interface Appliance {
  id: string;
  name: string;
  category: string;
  watts: number;
  surgeFactor: number;
  isAirConditioner: boolean;
  isActive: boolean;
}

type Draft = Pick<Appliance, "watts" | "surgeFactor">;

const EMPTY_FORM = { name: "", category: "", watts: "", surgeFactor: "1", isAirConditioner: false };

const ApplianceManager = () => {
  const [items, setItems] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const run = useAdminAction();

  useEffect(() => {
    api<Appliance[]>("/admin/appliances")
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const patch = async (id: string, body: Partial<Appliance>, message: string) => {
    const updated = await run(() => api<Appliance>(`/admin/appliances/${id}`, { method: "PATCH", json: body }), message);
    if (updated) {
      setItems((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setDrafts(({ [id]: _, ...rest }) => rest);
    }
  };

  const create = async () => {
    const created = await run(
      () =>
        api<Appliance>("/admin/appliances", {
          method: "POST",
          json: {
            name: form.name,
            category: form.category,
            watts: Number(form.watts),
            surgeFactor: Number(form.surgeFactor),
            isAirConditioner: form.isAirConditioner,
          },
        }),
      "Appliance added",
    );
    if (created) {
      setItems((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    }
  };

  const draftFor = (a: Appliance): Draft => drafts[a.id] ?? { watts: a.watts, surgeFactor: a.surgeFactor };
  const setDraft = (a: Appliance, field: keyof Draft, value: number) =>
    setDrafts((d) => ({ ...d, [a.id]: { ...draftFor(a), [field]: value } }));
  const visible = items.filter((a) => `${a.name} ${a.category}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Appliance Catalogue ({items.length})</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-40" />
          <Button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Wattage and surge factors are used by the sizing engine only and are never shown to customers.
          Surge factor guide: AC 3.0, pumps 2.5, fridges/freezers 2.0, other motors 2.0, everything else 1.0.
        </p>
        {showForm && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border rounded-lg bg-gray-50">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Running watts</Label><Input type="number" min="1" value={form.watts} onChange={(e) => setForm({ ...form, watts: e.target.value })} /></div>
            <div><Label>Surge factor</Label><Input type="number" step="0.1" min="1" value={form.surgeFactor} onChange={(e) => setForm({ ...form, surgeFactor: e.target.value })} /></div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="new-ac" checked={form.isAirConditioner} onCheckedChange={(v) => setForm({ ...form, isAirConditioner: v })} />
              <Label htmlFor="new-ac">Air conditioner</Label>
            </div>
            <div className="flex items-end"><Button onClick={create} className="flex items-center gap-2"><Save className="w-4 h-4" />Save</Button></div>
          </div>
        )}
        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Watts</TableHead>
                  <TableHead>Surge ×</TableHead>
                  <TableHead>AC</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((a) => {
                  const d = draftFor(a);
                  const dirty = d.watts !== a.watts || d.surgeFactor !== a.surgeFactor;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.category}</TableCell>
                      <TableCell>
                        <Input type="number" min="1" className="w-24" aria-label={`${a.name} watts`} value={d.watts} onChange={(e) => setDraft(a, "watts", Number(e.target.value))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.1" min="1" className="w-20" aria-label={`${a.name} surge factor`} value={d.surgeFactor} onChange={(e) => setDraft(a, "surgeFactor", Number(e.target.value))} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={a.isAirConditioner} aria-label={`${a.name} is an air conditioner`} onCheckedChange={(v) => patch(a.id, { isAirConditioner: v }, `${a.name} updated`)} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={a.isActive} aria-label={`${a.name} active`} onCheckedChange={(v) => patch(a.id, { isActive: v }, `${a.name} ${v ? "shown" : "hidden"}`)} />
                      </TableCell>
                      <TableCell>
                        {dirty && (
                          <Button size="sm" onClick={() => patch(a.id, d, `${a.name} updated`)} aria-label="Save"><Save className="w-4 h-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApplianceManager;
