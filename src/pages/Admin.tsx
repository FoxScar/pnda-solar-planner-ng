
import AdminUtility from "@/components/AdminUtility";

const Admin = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Admin Panel</h1>
        <AdminUtility />
      </div>
    </div>
  );
};

export default Admin;
