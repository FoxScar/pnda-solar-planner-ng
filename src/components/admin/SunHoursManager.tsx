import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAdminAction } from "./useAdminToast";

interface SunHourRow {
  state: string;
  region: string;
  annualAvg: number;
  wetSeason: number;
  drySeason: number;
  updatedAt: string;
}

type Values = Pick<SunHourRow, "wetSeason" | "annualAvg" | "drySeason">;
const FIELDS: { key: keyof Values; label: string }[] = [
  { key: "wetSeason", label: "Wet season" },
  { key: "annualAvg", label: "Annual avg" },
  { key: "drySeason", label: "Dry season" },
];

const SunHoursManager = () => {
  const [rows, setRows] = useState<SunHourRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Values>>({});
  const [loading, setLoading] = useState(true);
  const run = useAdminAction();

  useEffect(() => {
    api<SunHourRow[]>("/admin/sun-hours")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const valuesFor = (r: SunHourRow): Values => drafts[r.state] ?? { wetSeason: r.wetSeason, annualAvg: r.annualAvg, drySeason: r.drySeason };

  const save = async (r: SunHourRow) => {
    const updated = await run(
      () => api<SunHourRow>(`/admin/sun-hours/${encodeURIComponent(r.state)}`, { method: "PATCH", json: valuesFor(r) }),
      `${r.state} sun hours updated`,
    );
    if (updated) {
      setRows((prev) => prev.map((x) => (x.state === r.state ? updated : x)));
      setDrafts(({ [r.state]: _, ...rest }) => rest);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Sun Hours by State</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Systems are sized on the <strong>wet-season</strong> value so they work all year.
          Values must satisfy wet ≤ annual ≤ dry. States without a record fall back to 4.5 hours.
        </p>
        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Region</TableHead>
                  {FIELDS.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const v = valuesFor(r);
                  const dirty = FIELDS.some((f) => v[f.key] !== r[f.key]);
                  return (
                    <TableRow key={r.state}>
                      <TableCell className="font-medium">{r.state}</TableCell>
                      <TableCell>{r.region}</TableCell>
                      {FIELDS.map((f) => (
                        <TableCell key={f.key}>
                          <Input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="12"
                            className="w-20"
                            aria-label={`${r.state} ${f.label}`}
                            value={v[f.key]}
                            onChange={(e) => setDrafts((d) => ({ ...d, [r.state]: { ...v, [f.key]: Number(e.target.value) } }))}
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        {dirty && <Button size="sm" onClick={() => save(r)} aria-label="Save"><Save className="w-4 h-4" /></Button>}
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

export default SunHoursManager;
