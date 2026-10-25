import { hasRoleAtLeast } from "../../shared/domain";
import { useAuth } from "@/contexts/AuthContext";
import AdminAuthForm from "./admin/AdminAuthForm";
import AdminDashboard from "./admin/AdminDashboard";
import AdminAccessDenied from "./admin/AdminAccessDenied";

const AdminUtility = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <p className="text-center text-gray-600">Loading…</p>;
  }
  if (!user) {
    return <AdminAuthForm />;
  }
  if (!hasRoleAtLeast(user.role, "admin")) {
    return <AdminAccessDenied email={user.email} role={user.role} onSignOut={signOut} />;
  }
  return <AdminDashboard email={user.email} onSignOut={signOut} />;
};

export default AdminUtility;
