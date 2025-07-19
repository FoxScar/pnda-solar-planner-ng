
-- Update inverters with correct sizes
DELETE FROM inverters WHERE kva_rating IN (2.5, 3.5, 7.5, 10.0);

-- Add missing inverter sizes
INSERT INTO inverters (model_name, kva_rating, voltage_bus, surge_capacity, unit_cost, available) VALUES
('2kVA Pure Sine Wave Inverter', 2.0, 48, '4kVA for 10 seconds', 350000, true),
('3kVA Pure Sine Wave Inverter', 3.0, 48, '6kVA for 10 seconds', 450000, true),
('4kVA Pure Sine Wave Inverter', 4.0, 48, '8kVA for 10 seconds', 580000, true),
('6kVA Pure Sine Wave Inverter', 6.0, 48, '12kVA for 10 seconds', 780000, true),
('8kVA Pure Sine Wave Inverter', 8.0, 48, '16kVA for 10 seconds', 980000, true),
('12kVA Pure Sine Wave Inverter', 12.0, 48, '24kVA for 10 seconds', 1450000, true)
ON CONFLICT DO NOTHING;

-- Remove incorrect lithium battery
DELETE FROM batteries WHERE chemistry = 'Lithium' AND capacity_kwh = 2.4;

-- Add missing lithium battery sizes
INSERT INTO batteries (chemistry, voltage, capacity_kwh, dod, efficiency, unit_cost, available) VALUES
('Lithium', 48, 12.0, 0.8, 0.85, 1200000, true),
('Lithium', 48, 14.0, 0.8, 0.85, 1400000, true),
('Lithium', 48, 15.0, 0.8, 0.85, 1500000, true),
('Lithium', 48, 17.0, 0.8, 0.85, 1700000, true)
ON CONFLICT DO NOTHING;

-- Add missing panel sizes
INSERT INTO panels (model_name, rated_power, derating_factor, unit_cost, available) VALUES
('400W Monocrystalline', 400, 0.8, 120000, true),
('500W Monocrystalline', 500, 0.8, 150000, true),
('600W Monocrystalline', 600, 0.8, 200000, true)
ON CONFLICT DO NOTHING;

-- Update the inverter calculation function to handle merging
DROP FUNCTION IF EXISTS calculate_inverter_with_power_factor(INTEGER, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION calculate_inverter_with_merging(
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
  recommended BOOLEAN,
  is_merged BOOLEAN,
  merge_configuration TEXT,
  quantity INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  va_required INTEGER;
  min_kva_needed FLOAT;
  inverter_record RECORD;
  merge_record RECORD;
BEGIN
  -- Calculate VA requirement: Power ÷ Power Factor
  va_required := CEIL(peak_load_watts / power_factor);
  
  -- Add safety margin (20%)
  min_kva_needed := (va_required * (1 + safety_margin)) / 1000.0;
  
  -- First, find single inverters that can handle the load
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
      (inverter_record.kva_rating >= min_kva_needed AND inverter_record.kva_rating <= min_kva_needed * 1.5) as recommended,
      false as is_merged,
      NULL::TEXT as merge_configuration,
      1 as quantity;
  END LOOP;
  
  -- If load requires more than 5kVA, also show merged options
  IF min_kva_needed > 5.0 THEN
    FOR merge_record IN
      SELECT i.*
      FROM inverters i
      WHERE i.available = true
        AND i.kva_rating >= 5.0
        AND i.kva_rating * 2 >= min_kva_needed
      ORDER BY i.kva_rating ASC
    LOOP
      -- Calculate how many units needed
      DECLARE
        units_needed INTEGER := CEIL(min_kva_needed / merge_record.kva_rating);
      BEGIN
        IF units_needed <= 4 THEN -- Limit to reasonable merging
          RETURN QUERY SELECT
            merge_record.id,
            merge_record.model_name,
            (merge_record.kva_rating * units_needed)::FLOAT,
            merge_record.voltage_bus,
            merge_record.surge_capacity,
            (merge_record.unit_cost * units_needed)::INTEGER,
            va_required,
            (merge_record.kva_rating * units_needed >= min_kva_needed AND merge_record.kva_rating * units_needed <= min_kva_needed * 1.5) as recommended,
            true as is_merged,
            units_needed || ' × ' || merge_record.model_name as merge_configuration,
            units_needed;
        END IF;
      END;
    END LOOP;
  END IF;
END;
$$;

-- Update battery calculation to show multiple lithium options
DROP FUNCTION IF EXISTS calculate_battery_system(FLOAT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION calculate_lithium_battery_options(
  night_energy_kwh FLOAT,
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
  pros TEXT[],
  is_optimal BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  battery_record RECORD;
  min_cost INTEGER := 999999999;
  optimal_config RECORD;
BEGIN
  -- First pass: find the most cost-effective configuration
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.efficiency * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND b.chemistry = 'Lithium'
    ORDER BY b.capacity_kwh ASC
  LOOP
    IF (battery_record.needed_quantity * battery_record.unit_cost) < min_cost THEN
      min_cost := battery_record.needed_quantity * battery_record.unit_cost;
      optimal_config := battery_record;
    END IF;
  END LOOP;
  
  -- Second pass: return all viable lithium options
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.efficiency * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND b.chemistry = 'Lithium'
    ORDER BY b.capacity_kwh ASC
  LOOP
    RETURN QUERY SELECT
      battery_record.id,
      battery_record.chemistry,
      battery_record.voltage,
      battery_record.capacity_kwh,
      battery_record.needed_quantity::INTEGER,
      (battery_record.needed_quantity * battery_record.capacity_kwh)::FLOAT,
      (battery_record.needed_quantity * battery_record.unit_cost)::INTEGER,
      battery_record.needed_quantity || ' × ' || battery_record.capacity_kwh || 'kWh Lithium',
      ARRAY['10+ year lifespan', 'No maintenance', 'Fast charging', '85% round-trip efficiency'],
      (battery_record.id = optimal_config.id) as is_optimal;
  END LOOP;
END;
$$;

-- Function for AGM/Flooded batteries (no merging)
CREATE OR REPLACE FUNCTION calculate_traditional_battery_system(
  night_energy_kwh FLOAT,
  preferred_chemistry TEXT,
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
  battery_record RECORD;
  best_battery RECORD;
  min_cost INTEGER := 999999999;
BEGIN
  -- Find the best traditional battery option
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.efficiency * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND b.chemistry = preferred_chemistry
    ORDER BY (CEIL(night_energy_kwh / (b.efficiency * b.dod)) * b.unit_cost) ASC
  LOOP
    IF (battery_record.needed_quantity * battery_record.unit_cost) < min_cost THEN
      min_cost := battery_record.needed_quantity * battery_record.unit_cost;
      best_battery := battery_record;
    END IF;
  END LOOP;
  
  -- Return the best option
  IF best_battery IS NOT NULL THEN
    RETURN QUERY SELECT
      best_battery.id,
      best_battery.chemistry,
      best_battery.voltage,
      best_battery.capacity_kwh,
      best_battery.needed_quantity::INTEGER,
      (best_battery.needed_quantity * best_battery.capacity_kwh)::FLOAT,
      (best_battery.needed_quantity * best_battery.unit_cost)::INTEGER,
      best_battery.needed_quantity || ' × ' || ROUND((best_battery.capacity_kwh * 1000 / best_battery.voltage)::NUMERIC, 0) || 'Ah ' || best_battery.chemistry,
      CASE best_battery.chemistry
        WHEN 'AGM' THEN ARRAY['No maintenance', '5-7 year lifespan', 'Reliable', 'Good performance']  
        WHEN 'Flooded' THEN ARRAY['Lowest upfront cost', 'High capacity', 'Proven technology', 'Repairable']
        ELSE ARRAY['Standard battery']
      END;
  END IF;
END;
$$;
