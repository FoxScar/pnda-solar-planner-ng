
import { useAdminAuth } from "./admin/useAdminAuth";
import AdminAuthForm from "./admin/AdminAuthForm";
import AdminDashboard from "./admin/AdminDashboard";
import AdminAccessDenied from "./admin/AdminAccessDenied";

const AdminUtility = () => {
  const {
    currentUser,
    userRoles,
    isAdmin,
    needsInitialAdmin,
    loading,
    refreshing,
    handleSignOut,
    bootstrapInitialAdmin,
    handleAuthSuccess,
    refreshAdminData
  } = useAdminAuth();

  if (currentUser && isAdmin) {
    return (
      <AdminDashboard 
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onRefresh={refreshAdminData}
        refreshing={refreshing}
      />
    );
  }

  if (currentUser && !isAdmin) {
    return (
      <AdminAccessDenied
        currentUser={currentUser}
        userRoles={userRoles}
        needsInitialAdmin={needsInitialAdmin}
        loading={loading}
        onSignOut={handleSignOut}
        onBootstrapAdmin={bootstrapInitialAdmin}
      />
    );
  }

  return (
    <AdminAuthForm onAuthSuccess={handleAuthSuccess} />
  );
};

export default AdminUtility;
