
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

const InverterManager = () => {
  const [inverters, setInverters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    model_name: '',
    kva_rating: '',
    voltage_bus: '',
    surge_capacity: '',
    unit_cost: '',
    available: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchInverters();
  }, []);

  const fetchInverters = async () => {
    try {
      const { data, error } = await supabase
        .from('inverters')
        .select('*')
        .order('kva_rating', { ascending: true });
      
      if (error) throw error;
      setInverters(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch inverters",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      model_name: '',
      kva_rating: '',
      voltage_bus: '',
      surge_capacity: '',
      unit_cost: '',
      available: true
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
        model_name: formData.model_name,
        kva_rating: parseFloat(formData.kva_rating),
        voltage_bus: parseInt(formData.voltage_bus),
        surge_capacity: formData.surge_capacity,
        unit_cost: parseInt(formData.unit_cost),
        available: formData.available
      };

      if (editingId) {
        const { error } = await supabase
          .from('inverters')
          .update(dataToSave)
          .eq('id', editingId);
        
        if (error) throw error;
        toast({ title: "Success", description: "Inverter updated successfully" });
      } else {
        const { error } = await supabase
          .from('inverters')
          .insert([dataToSave]);
        
        if (error) throw error;
        toast({ title: "Success", description: "Inverter added successfully" });
      }

      await fetchInverters();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (inverter) => {
    setFormData({
      model_name: inverter.model_name,
      kva_rating: inverter.kva_rating.toString(),
      voltage_bus: inverter.voltage_bus.toString(),
      surge_capacity: inverter.surge_capacity || '',
      unit_cost: inverter.unit_cost.toString(),
      available: inverter.available
    });
    setEditingId(inverter.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this inverter?')) return;
    
    try {
      const { error } = await supabase
        .from('inverters')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Inverter deleted successfully" });
      await fetchInverters();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center">Loading inverters...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Inverter Management</h3>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          Add Inverter
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Inverter' : 'Add New Inverter'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model_name">Model Name</Label>
                <Input
                  id="model_name"
                  value={formData.model_name}
                  onChange={(e) => handleInputChange('model_name', e.target.value)}
                  placeholder="e.g., 5KVA Hybrid Inverter"
                />
              </div>
              <div>
                <Label htmlFor="kva_rating">KVA Rating</Label>
                <Input
                  id="kva_rating"
                  type="number"
                  step="0.1"
                  value={formData.kva_rating}
                  onChange={(e) => handleInputChange('kva_rating', e.target.value)}
                  placeholder="e.g., 5.0, 10.0"
                />
              </div>
              <div>
                <Label htmlFor="voltage_bus">Voltage Bus (V)</Label>
                <Input
                  id="voltage_bus"
                  type="number"
                  value={formData.voltage_bus}
                  onChange={(e) => handleInputChange('voltage_bus', e.target.value)}
                  placeholder="e.g., 48, 24"
                />
              </div>
              <div>
                <Label htmlFor="surge_capacity">Surge Capacity</Label>
                <Input
                  id="surge_capacity"
                  value={formData.surge_capacity}
                  onChange={(e) => handleInputChange('surge_capacity', e.target.value)}
                  placeholder="e.g., 150% for 10 seconds"
                />
              </div>
              <div>
                <Label htmlFor="unit_cost">Unit Cost (₦)</Label>
                <Input
                  id="unit_cost"
                  type="number"
                  value={formData.unit_cost}
                  onChange={(e) => handleInputChange('unit_cost', e.target.value)}
                  placeholder="e.g., 500000"
                />
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
                <TableHead>Model Name</TableHead>
                <TableHead>KVA Rating</TableHead>
                <TableHead>Voltage Bus</TableHead>
                <TableHead>Surge Capacity</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inverters.map((inverter) => (
                <TableRow key={inverter.id}>
                  <TableCell className="font-medium">{inverter.model_name}</TableCell>
                  <TableCell>{inverter.kva_rating}KVA</TableCell>
                  <TableCell>{inverter.voltage_bus}V</TableCell>
                  <TableCell>{inverter.surge_capacity || 'N/A'}</TableCell>
                  <TableCell>₦{inverter.unit_cost.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={inverter.available ? "default" : "secondary"}>
                      {inverter.available ? "Available" : "Unavailable"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(inverter)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(inverter.id)}
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

export default InverterManager;
