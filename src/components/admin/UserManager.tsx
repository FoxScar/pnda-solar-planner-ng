import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ROLES, type Role } from "../../../shared/domain";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useAdminAction } from "./useAdminToast";

interface UserRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  role: Role | null;
  status: "active" | "suspended" | null;
  companyName: string | null;
}

const UserManager = () => {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: me } = useAuth();
  const run = useAdminAction();

  useEffect(() => {
    api<UserRow[]>("/admin/users")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (row: UserRow, role: Role) => {
    const updated = await run(
      () => api(`/admin/users/${row.id}/role`, { method: "PATCH", json: { role } }),
      `${row.email} is now ${role}`,
    );
    if (updated) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, role } : r)));
  };

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="px-0 sm:px-6">
        <CardTitle>Users ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : (
          <>
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border bg-white p-3 space-y-2">
                <p className="font-medium break-all">{r.email}</p>
                <p className="text-sm text-gray-600">
                  {r.companyName ? `${r.companyName} · ` : ""}Joined {new Date(r.createdAt).toLocaleDateString("en-NG")} · <span className="capitalize">{r.status ?? "active"}</span>
                </p>
                {r.id === me?.id ? (
                  <p className="text-sm capitalize">{r.role} (you)</p>
                ) : (
                  <NativeSelect
                    value={r.role ?? "consumer"}
                    onValueChange={(v) => changeRole(r, v as Role)}
                    aria-label={`Role for ${r.email}`}
                    options={ROLES.map((role) => ({ value: role, label: role[0]!.toUpperCase() + role.slice(1) }))}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.email}{r.companyName ? <span className="text-gray-500"> · {r.companyName}</span> : null}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString("en-NG")}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.status ?? "active"}</Badge></TableCell>
                    <TableCell>
                      {r.id === me?.id ? (
                        <span className="capitalize">{r.role} (you)</span>
                      ) : (
                        <NativeSelect
                          value={r.role ?? "consumer"}
                          onValueChange={(v) => changeRole(r, v as Role)}
                          className="w-36 capitalize"
                          aria-label={`Role for ${r.email}`}
                          options={ROLES.map((role) => ({ value: role, label: role[0]!.toUpperCase() + role.slice(1) }))}
                        />
                      )}
                    </TableCell>
                  </TableRow>
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

export default UserManager;
