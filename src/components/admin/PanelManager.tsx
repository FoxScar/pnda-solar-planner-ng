
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

const PanelManager = () => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    model_name: '',
    rated_power: '',
    derating_factor: '',
    unit_cost: '',
    available: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPanels();
  }, []);

  const fetchPanels = async () => {
    try {
      const { data, error } = await supabase
        .from('panels')
        .select('*')
        .order('model_name', { ascending: true });
      
      if (error) throw error;
      setPanels(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch panels",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      model_name: '',
      rated_power: '',
      derating_factor: '',
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
        rated_power: parseInt(formData.rated_power),
        derating_factor: parseFloat(formData.derating_factor),
        unit_cost: parseInt(formData.unit_cost),
        available: formData.available
      };

      if (editingId) {
        const { error } = await supabase
          .from('panels')
          .update(dataToSave)
          .eq('id', editingId);
        
        if (error) throw error;
        toast({ title: "Success", description: "Panel updated successfully" });
      } else {
        const { error } = await supabase
          .from('panels')
          .insert([dataToSave]);
        
        if (error) throw error;
        toast({ title: "Success", description: "Panel added successfully" });
      }

      await fetchPanels();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (panel) => {
    setFormData({
      model_name: panel.model_name,
      rated_power: panel.rated_power.toString(),
      derating_factor: panel.derating_factor.toString(),
      unit_cost: panel.unit_cost.toString(),
      available: panel.available
    });
    setEditingId(panel.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this panel?')) return;
    
    try {
      const { error } = await supabase
        .from('panels')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Panel deleted successfully" });
      await fetchPanels();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center">Loading panels...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Panel Management</h3>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          Add Panel
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Panel' : 'Add New Panel'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model_name">Model Name</Label>
                <Input
                  id="model_name"
                  value={formData.model_name}
                  onChange={(e) => handleInputChange('model_name', e.target.value)}
                  placeholder="e.g., 550W Monocrystalline"
                />
              </div>
              <div>
                <Label htmlFor="rated_power">Rated Power (W)</Label>
                <Input
                  id="rated_power"
                  type="number"
                  value={formData.rated_power}
                  onChange={(e) => handleInputChange('rated_power', e.target.value)}
                  placeholder="e.g., 550, 400"
                />
              </div>
              <div>
                <Label htmlFor="derating_factor">Derating Factor</Label>
                <Input
                  id="derating_factor"
                  type="number"
                  step="0.01"
                  value={formData.derating_factor}
                  onChange={(e) => handleInputChange('derating_factor', e.target.value)}
                  placeholder="e.g., 0.8, 0.75"
                />
              </div>
              <div>
                <Label htmlFor="unit_cost">Unit Cost (₦)</Label>
                <Input
                  id="unit_cost"
                  type="number"
                  value={formData.unit_cost}
                  onChange={(e) => handleInputChange('unit_cost', e.target.value)}
                  placeholder="e.g., 150000"
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
                <TableHead>Rated Power</TableHead>
                <TableHead>Derating Factor</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {panels.map((panel) => (
                <TableRow key={panel.id}>
                  <TableCell className="font-medium">{panel.model_name}</TableCell>
                  <TableCell>{panel.rated_power}W</TableCell>
                  <TableCell>{(panel.derating_factor * 100).toFixed(0)}%</TableCell>
                  <TableCell>₦{panel.unit_cost.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={panel.available ? "default" : "secondary"}>
                      {panel.available ? "Available" : "Unavailable"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(panel)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(panel.id)}
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

export default PanelManager;
