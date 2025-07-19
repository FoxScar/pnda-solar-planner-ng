
-- Remove polycrystalline panels from quotations
UPDATE panels SET available = false WHERE model_name ILIKE '%polycrystalline%';

-- Update monocrystalline panels to use 80% derating factor
UPDATE panels SET derating_factor = 0.8 WHERE model_name ILIKE '%monocrystalline%' AND available = true;

-- Add 590W monocrystalline panel option if it doesn't exist
INSERT INTO panels (model_name, rated_power, derating_factor, unit_cost, available)
SELECT '590W Monocrystalline', 590, 0.8, 180000, true
WHERE NOT EXISTS (
  SELECT 1 FROM panels WHERE model_name = '590W Monocrystalline'
);

-- Add 7.5kWh lithium battery option if it doesn't exist
INSERT INTO batteries (chemistry, voltage, capacity_kwh, dod, efficiency, unit_cost, available)
SELECT 'Lithium', 48, 7.5, 0.8, 0.85, 750000, true
WHERE NOT EXISTS (
  SELECT 1 FROM batteries WHERE chemistry = 'Lithium' AND capacity_kwh = 7.5
);

-- Add power_factor column to inverters table
ALTER TABLE inverters ADD COLUMN IF NOT EXISTS power_factor DOUBLE PRECISION DEFAULT 0.8;

-- Update existing inverters to have power factor
UPDATE inverters SET power_factor = 0.8 WHERE power_factor IS NULL;

-- Drop and recreate the calculate_battery_system function with correct logic
DROP FUNCTION IF EXISTS calculate_battery_system(FLOAT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION calculate_battery_system(
  night_energy_kwh FLOAT,
  preferred_chemistry TEXT DEFAULT NULL,
  night_duration_hours INTEGER DEFAULT 13
)
RETURNS TABLE (
  battery_id UUID,
  chemistry TEXT,
  voltage INTEGER,
  capacity_kwh FLOAT,
  recommended_quantity INTEGER,
  total_capacity_kwh FLOAT,
  total_cost INTEGER,
  configuration TEXT,
  pros TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  required_capacity FLOAT;
  battery_record RECORD;
  best_battery RECORD;
  min_cost INTEGER := 999999999;
BEGIN
  -- Calculate required capacity using proper formula: Night Energy ÷ (Battery Efficiency × DoD)
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.efficiency * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND (preferred_chemistry IS NULL OR b.chemistry = preferred_chemistry)
    ORDER BY b.chemistry = 'Lithium' DESC, -- Prefer Lithium
             (CEIL(night_energy_kwh / (b.efficiency * b.dod)) * b.unit_cost) ASC
  LOOP
    -- Calculate total cost for this configuration
    IF (battery_record.needed_quantity * battery_record.unit_cost) < min_cost THEN
      min_cost := battery_record.needed_quantity * battery_record.unit_cost;
      best_battery := battery_record;
    END IF;
  END LOOP;
  
  -- Return the best battery configuration
  IF best_battery IS NOT NULL THEN
    RETURN QUERY SELECT
      best_battery.id,
      best_battery.chemistry,
      best_battery.voltage,
      best_battery.capacity_kwh,
      best_battery.needed_quantity::INTEGER,
      (best_battery.needed_quantity * best_battery.capacity_kwh)::FLOAT,
      (best_battery.needed_quantity * best_battery.unit_cost)::INTEGER,
      CASE 
        WHEN best_battery.chemistry = 'Lithium' THEN
          best_battery.needed_quantity || ' × ' || best_battery.capacity_kwh || 'kWh Lithium'
        ELSE
          best_battery.needed_quantity || ' × ' || ROUND((best_battery.capacity_kwh * 1000 / best_battery.voltage)::NUMERIC, 0) || 'Ah ' || best_battery.chemistry
      END,
      CASE best_battery.chemistry
        WHEN 'Lithium' THEN ARRAY['10+ year lifespan', 'No maintenance', 'Fast charging', '85% round-trip efficiency']
        WHEN 'AGM' THEN ARRAY['No maintenance', '5-7 year lifespan', 'Reliable', 'Good performance']  
        WHEN 'Flooded' THEN ARRAY['Lowest upfront cost', 'High capacity', 'Proven technology', 'Repairable']
        ELSE ARRAY['Standard battery']
      END;
  END IF;
END;
$$;

-- Drop and recreate the calculate_panel_system function with correct logic
DROP FUNCTION IF EXISTS calculate_panel_system(FLOAT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION calculate_panel_system(
  daytime_load_watts INTEGER,
  night_energy_kwh FLOAT,
  state_name TEXT,
  sun_hours_per_day FLOAT DEFAULT 5.0,
  preferred_panel_model TEXT DEFAULT NULL
)
RETURNS TABLE (
  panel_id UUID,
  model_name TEXT,
  rated_power INTEGER,
  recommended_quantity INTEGER,
  total_watts INTEGER,
  total_cost INTEGER,
  daily_generation_kwh FLOAT,
  derating_factor FLOAT,
  calculation_breakdown JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  battery_charging_requirement INTEGER;
  total_power_requirement INTEGER;
  adjusted_power_requirement INTEGER;
  panel_record RECORD;
  best_panel RECORD;
  min_cost INTEGER := 999999999;
  required_quantity INTEGER;
  sun_hours FLOAT;
BEGIN
  -- Get sun hours for the state
  SELECT hours INTO sun_hours FROM sun_hours WHERE state = state_name;
  IF sun_hours IS NULL THEN
    sun_hours := sun_hours_per_day; -- Use provided default
  END IF;
  
  -- Calculate battery charging requirement: Night Energy ÷ Sun Hours
  battery_charging_requirement := CEIL(night_energy_kwh * 1000 / sun_hours); -- Convert kWh to W
  
  -- Total power requirement = Daytime Load + Battery Charging Requirement
  total_power_requirement := daytime_load_watts + battery_charging_requirement;
  
  -- Account for inverter efficiency (90%) and wiring losses (5%)
  adjusted_power_requirement := CEIL(total_power_requirement / (0.9 * 0.95));
  
  -- Find the best panel option
  FOR panel_record IN
    SELECT p.*
    FROM panels p
    WHERE p.available = true
      AND (preferred_panel_model IS NULL OR p.model_name = preferred_panel_model)
    ORDER BY p.model_name ILIKE '%590W%' DESC, -- Prefer 590W panels
             p.model_name ILIKE '%monocrystalline%' DESC, -- Then monocrystalline
             p.rated_power DESC
  LOOP
    -- Calculate required quantity: Total Power ÷ (Panel Power × Derating Factor)
    required_quantity := CEIL(adjusted_power_requirement::FLOAT / (panel_record.rated_power * panel_record.derating_factor));
    required_quantity := GREATEST(required_quantity, 1); -- At least 1 panel
    
    -- Calculate total cost
    IF (required_quantity * panel_record.unit_cost) < min_cost THEN
      min_cost := required_quantity * panel_record.unit_cost;
      best_panel := panel_record;
      best_panel.needed_quantity := required_quantity;
    END IF;
  END LOOP;
  
  -- Return the best panel configuration
  IF best_panel IS NOT NULL THEN
    RETURN QUERY SELECT
      best_panel.id,
      best_panel.model_name,
      best_panel.rated_power,
      best_panel.needed_quantity,
      (best_panel.needed_quantity * best_panel.rated_power)::INTEGER,
      (best_panel.needed_quantity * best_panel.unit_cost)::INTEGER,
      ROUND(((best_panel.needed_quantity * best_panel.rated_power * best_panel.derating_factor * sun_hours) / 1000)::NUMERIC, 1)::FLOAT,
      best_panel.derating_factor,
      jsonb_build_object(
        'daytime_load_watts', daytime_load_watts,
        'night_energy_kwh', night_energy_kwh,
        'battery_charging_watts', battery_charging_requirement,
        'total_power_requirement', total_power_requirement,
        'adjusted_for_losses', adjusted_power_requirement,
        'sun_hours', sun_hours,
        'derating_factor', best_panel.derating_factor,
        'inverter_efficiency', 0.9,
        'wiring_efficiency', 0.95
      );
  END IF;
END;
$$;

-- Create a function for proper inverter sizing with power factor
CREATE OR REPLACE FUNCTION calculate_inverter_with_power_factor(
  peak_load_watts INTEGER,
  power_factor FLOAT DEFAULT 0.8,
  safety_margin FLOAT DEFAULT 0.2
)
RETURNS TABLE (
  inverter_id UUID,
  model_name TEXT,
  kva_rating FLOAT,
  voltage_bus INTEGER,
  surge_capacity TEXT,
  unit_cost INTEGER,
  va_requirement INTEGER,
  recommended BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  va_required INTEGER;
  min_kva_needed FLOAT;
  inverter_record RECORD;
BEGIN
  -- Calculate VA requirement: Power ÷ Power Factor
  va_required := CEIL(peak_load_watts / power_factor);
  
  -- Add safety margin (10-20%)
  min_kva_needed := (va_required * (1 + safety_margin)) / 1000.0;
  
  -- Find suitable inverters
  FOR inverter_record IN
    SELECT i.*
    FROM inverters i
    WHERE i.available = true
      AND i.kva_rating >= min_kva_needed
    ORDER BY i.kva_rating ASC, i.unit_cost ASC
  LOOP
    RETURN QUERY SELECT
      inverter_record.id,
      inverter_record.model_name,
      inverter_record.kva_rating,
      inverter_record.voltage_bus,
      inverter_record.surge_capacity,
      inverter_record.unit_cost,
      va_required,
      (inverter_record.kva_rating >= min_kva_needed AND inverter_record.kva_rating <= min_kva_needed * 1.5) as recommended;
  END LOOP;
END;
$$;
