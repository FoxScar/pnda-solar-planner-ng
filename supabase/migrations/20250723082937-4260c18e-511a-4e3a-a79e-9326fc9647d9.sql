-- Fix the battery calculation formula to properly include battery capacity
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
           CEIL(night_energy_kwh / (b.capacity_kwh * b.efficiency * b.dod)) as needed_quantity
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
  
  -- Second pass: return all viable lithium options with corrected calculation
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.capacity_kwh * b.efficiency * b.dod)) as needed_quantity
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

-- Also fix the traditional battery calculation
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
  -- Find the best traditional battery option with corrected calculation
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.capacity_kwh * b.efficiency * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND b.chemistry = preferred_chemistry
    ORDER BY (CEIL(night_energy_kwh / (b.capacity_kwh * b.efficiency * b.dod)) * b.unit_cost) ASC
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