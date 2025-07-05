
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ApplianceManager = () => {
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    power_rating: '',
    category: '',
    is_energy_efficient: false
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAppliances();
  }, []);

  const fetchAppliances = async () => {
    try {
      const { data, error } = await supabase
        .from('appliances')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;
      setAppliances(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch appliances",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      power_rating: '',
      category: '',
      is_energy_efficient: false
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      const dataToSave = {
        name: formData.name,
        power_rating: parseInt(formData.power_rating),
        category: formData.category,
        is_energy_efficient: formData.is_energy_efficient
      };

      if (editingId) {
        const { error } = await supabase
          .from('appliances')
          .update(dataToSave)
          .eq('id', editingId);
        
        if (error) throw error;
        toast({ title: "Success", description: "Appliance updated successfully" });
      } else {
        const { error } = await supabase
          .from('appliances')
          .insert([dataToSave]);
        
        if (error) throw error;
        toast({ title: "Success", description: "Appliance added successfully" });
      }

      await fetchAppliances();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (appliance) => {
    setFormData({
      name: appliance.name,
      power_rating: appliance.power_rating.toString(),
      category: appliance.category,
      is_energy_efficient: appliance.is_energy_efficient
    });
    setEditingId(appliance.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this appliance?')) return;
    
    try {
      const { error } = await supabase
        .from('appliances')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Appliance deleted successfully" });
      await fetchAppliances();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center">Loading appliances...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Appliance Management</h3>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          Add Appliance
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Appliance' : 'Add New Appliance'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., LED Bulb 10W"
                />
              </div>
              <div>
                <Label htmlFor="power_rating">Power Rating (W)</Label>
                <Input
                  id="power_rating"
                  type="number"
                  value={formData.power_rating}
                  onChange={(e) => handleInputChange('power_rating', e.target.value)}
                  placeholder="e.g., 10, 50, 100"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="e.g., Lighting, Kitchen, Entertainment"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_energy_efficient"
                  checked={formData.is_energy_efficient}
                  onChange={(e) => handleInputChange('is_energy_efficient', e.target.checked)}
                />
                <Label htmlFor="is_energy_efficient">Energy Efficient</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Update' : 'Save'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Power Rating</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Energy Efficient</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appliances.map((appliance) => (
                <TableRow key={appliance.id}>
                  <TableCell className="font-medium">{appliance.name}</TableCell>
                  <TableCell>{appliance.power_rating}W</TableCell>
                  <TableCell>{appliance.category}</TableCell>
                  <TableCell>
                    <Badge variant={appliance.is_energy_efficient ? "default" : "secondary"}>
                      {appliance.is_energy_efficient ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(appliance)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(appliance.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplianceManager;
