
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

const BatteryManager = () => {
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    chemistry: '',
    voltage: '',
    capacity_kwh: '',
    dod: '',
    efficiency: '',
    unit_cost: '',
    available: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchBatteries();
  }, []);

  const fetchBatteries = async () => {
    try {
      const { data, error } = await supabase
        .from('batteries')
        .select('*')
        .order('chemistry', { ascending: true });
      
      if (error) throw error;
      setBatteries(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch batteries",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      chemistry: '',
      voltage: '',
      capacity_kwh: '',
      dod: '',
      efficiency: '',
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
        chemistry: formData.chemistry,
        voltage: parseInt(formData.voltage),
        capacity_kwh: parseFloat(formData.capacity_kwh),
        dod: parseFloat(formData.dod),
        efficiency: parseFloat(formData.efficiency),
        unit_cost: parseInt(formData.unit_cost),
        available: formData.available
      };

      if (editingId) {
        const { error } = await supabase
          .from('batteries')
          .update(dataToSave)
          .eq('id', editingId);
        
        if (error) throw error;
        toast({ title: "Success", description: "Battery updated successfully" });
      } else {
        const { error } = await supabase
          .from('batteries')
          .insert([dataToSave]);
        
        if (error) throw error;
        toast({ title: "Success", description: "Battery added successfully" });
      }

      await fetchBatteries();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (battery) => {
    setFormData({
      chemistry: battery.chemistry,
      voltage: battery.voltage.toString(),
      capacity_kwh: battery.capacity_kwh.toString(),
      dod: battery.dod.toString(),
      efficiency: battery.efficiency.toString(),
      unit_cost: battery.unit_cost.toString(),
      available: battery.available
    });
    setEditingId(battery.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this battery?')) return;
    
    try {
      const { error } = await supabase
        .from('batteries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Battery deleted successfully" });
      await fetchBatteries();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center">Loading batteries...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Battery Management</h3>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          Add Battery
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Battery' : 'Add New Battery'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="chemistry">Chemistry</Label>
                <Input
                  id="chemistry"
                  value={formData.chemistry}
                  onChange={(e) => handleInputChange('chemistry', e.target.value)}
                  placeholder="e.g., Lithium, AGM, Flooded"
                />
              </div>
              <div>
                <Label htmlFor="voltage">Voltage (V)</Label>
                <Input
                  id="voltage"
                  type="number"
                  value={formData.voltage}
                  onChange={(e) => handleInputChange('voltage', e.target.value)}
                  placeholder="e.g., 12, 24, 48"
                />
              </div>
              <div>
                <Label htmlFor="capacity_kwh">Capacity (kWh)</Label>
                <Input
                  id="capacity_kwh"
                  type="number"
                  step="0.1"
                  value={formData.capacity_kwh}
                  onChange={(e) => handleInputChange('capacity_kwh', e.target.value)}
                  placeholder="e.g., 5.12, 10.24"
                />
              </div>
              <div>
                <Label htmlFor="dod">Depth of Discharge</Label>
                <Input
                  id="dod"
                  type="number"
                  step="0.01"
                  value={formData.dod}
                  onChange={(e) => handleInputChange('dod', e.target.value)}
                  placeholder="e.g., 0.8, 0.5"
                />
              </div>
              <div>
                <Label htmlFor="efficiency">Efficiency</Label>
                <Input
                  id="efficiency"
                  type="number"
                  step="0.01"
                  value={formData.efficiency}
                  onChange={(e) => handleInputChange('efficiency', e.target.value)}
                  placeholder="e.g., 0.95, 0.85"
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
                <TableHead>Chemistry</TableHead>
                <TableHead>Voltage</TableHead>
                <TableHead>Capacity (kWh)</TableHead>
                <TableHead>DoD</TableHead>
                <TableHead>Efficiency</TableHead>
                <TableHead>Cost (₦)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batteries.map((battery) => (
                <TableRow key={battery.id}>
                  <TableCell className="font-medium">{battery.chemistry}</TableCell>
                  <TableCell>{battery.voltage}V</TableCell>
                  <TableCell>{battery.capacity_kwh}kWh</TableCell>
                  <TableCell>{(battery.dod * 100).toFixed(0)}%</TableCell>
                  <TableCell>{(battery.efficiency * 100).toFixed(0)}%</TableCell>
                  <TableCell>₦{battery.unit_cost.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={battery.available ? "default" : "secondary"}>
                      {battery.available ? "Available" : "Unavailable"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(battery)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(battery.id)}
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

export default BatteryManager;
