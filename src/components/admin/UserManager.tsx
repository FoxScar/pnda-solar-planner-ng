import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    <Card>
      <CardHeader>
        <CardTitle>Users ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
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
                        <Select value={r.role ?? "consumer"} onValueChange={(v) => changeRole(r, v as Role)}>
                          <SelectTrigger className="w-36 capitalize" aria-label={`Role for ${r.email}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserManager;
