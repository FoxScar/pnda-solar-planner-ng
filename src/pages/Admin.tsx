
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AdminUtility from "@/components/AdminUtility";
import { Button } from "@/components/ui/button";

const Admin = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-4 sm:mb-6">
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Main App
            </Button>
          </Link>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-8">Admin Panel</h1>
        <AdminUtility />
      </div>
    </div>
  );
};

export default Admin;
