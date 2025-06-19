
-- Create appliances table
CREATE TABLE public.appliances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  power_rating INTEGER NOT NULL,
  category TEXT NOT NULL,
  is_energy_efficient BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inverters table
CREATE TABLE public.inverters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  kva_rating FLOAT NOT NULL,
  voltage_bus INTEGER NOT NULL,
  surge_capacity TEXT,
  unit_cost INTEGER NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create batteries table
CREATE TABLE public.batteries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chemistry TEXT NOT NULL,
  voltage INTEGER NOT NULL,
  capacity_kwh FLOAT NOT NULL,
  dod FLOAT NOT NULL,
  efficiency FLOAT NOT NULL,
  unit_cost INTEGER NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create panels table
CREATE TABLE public.panels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  rated_power INTEGER NOT NULL,
  derating_factor FLOAT NOT NULL,
  unit_cost INTEGER NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sun_hours table for state-based solar hours
CREATE TABLE public.sun_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  hours FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert sample Nigerian appliances
INSERT INTO public.appliances (name, power_rating, category, is_energy_efficient) VALUES
('LED Bulb (9W)', 9, 'Lighting', true),
('CFL Bulb (23W)', 23, 'Lighting', false),
('Ceiling Fan', 75, 'Cooling', false),
('Standing Fan', 55, 'Cooling', false),
('Small Refrigerator', 150, 'Kitchen', true),
('Large Refrigerator', 300, 'Kitchen', false),
('32" LED TV', 80, 'Entertainment', true),
('43" LED TV', 120, 'Entertainment', false),
('Desktop Computer', 300, 'Electronics', false),
('Laptop', 65, 'Electronics', true),
('Washing Machine', 500, 'Appliances', false),
('Iron', 1000, 'Appliances', false),
('Microwave', 1200, 'Kitchen', false),
('Air Conditioner (1HP)', 1500, 'Cooling', false),
('Water Heater', 2000, 'Appliances', false);

-- Insert sample inverters
INSERT INTO public.inverters (model_name, kva_rating, voltage_bus, surge_capacity, unit_cost) VALUES
('Felicity 1.5KVA 12V', 1.5, 12, '3000W', 85000),
('Felicity 2.5KVA 24V', 2.5, 24, '5000W', 125000),
('Felicity 3.5KVA 24V', 3.5, 24, '7000W', 165000),
('Felicity 5KVA 48V', 5.0, 48, '10000W', 245000),
('Felicity 7.5KVA 48V', 7.5, 48, '15000W', 325000),
('Felicity 10KVA 48V', 10.0, 48, '20000W', 485000);

-- Insert sample batteries
INSERT INTO public.batteries (chemistry, voltage, capacity_kwh, dod, efficiency, unit_cost) VALUES
('Lithium', 12, 2.4, 0.95, 0.95, 180000),
('Lithium', 12, 5.0, 0.95, 0.95, 350000),
('Lithium', 12, 10.0, 0.95, 0.95, 650000),
('AGM', 12, 1.2, 0.8, 0.85, 85000),
('AGM', 12, 2.0, 0.8, 0.85, 125000),
('Flooded', 12, 1.5, 0.7, 0.8, 45000),
('Flooded', 12, 2.0, 0.7, 0.8, 65000);

-- Insert sample panels
INSERT INTO public.panels (model_name, rated_power, derating_factor, unit_cost) VALUES
('Monocrystalline 300W', 300, 0.85, 45000),
('Monocrystalline 400W', 400, 0.85, 58000),
('Monocrystalline 500W', 500, 0.85, 72000),
('Polycrystalline 300W', 300, 0.8, 38000),
('Polycrystalline 400W', 400, 0.8, 48000);

-- Insert Nigerian states sun hours data
INSERT INTO public.sun_hours (state, hours) VALUES
('Lagos', 4.2),
('Abuja', 5.1),
('Kano', 6.8),
('Rivers', 3.9),
('Oyo', 4.8),
('Kaduna', 5.9),
('Ogun', 4.5),
('Katsina', 6.5),
('Anambra', 4.3),
('Borno', 7.2),
('Delta', 4.0),
('Imo', 4.1),
('Niger', 5.5),
('Akwa Ibom', 3.8),
('Ondo', 4.4),
('Osun', 4.6),
('Kwara', 5.0),
('Sokoto', 6.9),
('Kebbi', 6.7),
('Bauchi', 6.3),
('Jigawa', 6.4),
('Benue', 4.9),
('Plateau', 5.3),
('Adamawa', 5.8),
('Nasarawa', 5.2),
('Zamfara', 6.6),
('Enugu', 4.2),
('Ebonyi', 4.1),
('Ekiti', 4.5),
('Abia', 4.0),
('Gombe', 6.0),
('Yobe', 6.8),
('Taraba', 5.4),
('Cross River', 3.7),
('Edo', 4.3),
('Kogi', 4.8),
('Bayelsa', 3.6);

-- Enable Row Level Security (public read access for now, we'll add admin policies later)
ALTER TABLE public.appliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sun_hours ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (for the calculator)
CREATE POLICY "Allow public read access to appliances" ON public.appliances FOR SELECT USING (true);
CREATE POLICY "Allow public read access to inverters" ON public.inverters FOR SELECT USING (true);
CREATE POLICY "Allow public read access to batteries" ON public.batteries FOR SELECT USING (true);
CREATE POLICY "Allow public read access to panels" ON public.panels FOR SELECT USING (true);
CREATE POLICY "Allow public read access to sun_hours" ON public.sun_hours FOR SELECT USING (true);
