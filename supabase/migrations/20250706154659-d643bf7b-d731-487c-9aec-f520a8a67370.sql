
-- Fix the calculate_battery_system function to properly cast recommended_quantity to INTEGER
CREATE OR REPLACE FUNCTION calculate_battery_system(
  daily_energy_kwh FLOAT,
  preferred_chemistry TEXT DEFAULT NULL,
  backup_hours INTEGER DEFAULT 24
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
  -- Calculate required capacity with safety margin
  required_capacity := daily_energy_kwh * 1.3; -- 30% safety margin
  
  -- Find the best battery option
  FOR battery_record IN
    SELECT b.*, 
           CEIL(required_capacity / (b.capacity_kwh * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND (preferred_chemistry IS NULL OR b.chemistry = preferred_chemistry)
    ORDER BY b.chemistry = 'Lithium' DESC, -- Prefer Lithium
             (CEIL(required_capacity / (b.capacity_kwh * b.dod)) * b.unit_cost) ASC
  LOOP
    -- Calculate total cost for this configuration
    IF (battery_record.needed_quantity * battery_record.unit_cost) < min_cost THEN
      min_cost := battery_record.needed_quantity * battery_record.unit_cost;
      best_battery := battery_record;
    END IF;
  END LOOP;
  
  -- Return the best battery configuration with proper INTEGER casting
  IF best_battery IS NOT NULL THEN
    RETURN QUERY SELECT
      best_battery.id,
      best_battery.chemistry,
      best_battery.voltage,
      best_battery.capacity_kwh,
      best_battery.needed_quantity::INTEGER, -- Cast to INTEGER here
      (best_battery.needed_quantity * best_battery.capacity_kwh)::FLOAT,
      (best_battery.needed_quantity * best_battery.unit_cost)::INTEGER,
      CASE 
        WHEN best_battery.chemistry = 'Lithium' THEN
          best_battery.needed_quantity || ' × ' || best_battery.capacity_kwh || 'kWh Lithium'
        ELSE
          best_battery.needed_quantity || ' × ' || ROUND((best_battery.capacity_kwh * 1000 / best_battery.voltage)::NUMERIC, 0) || 'Ah ' || best_battery.chemistry
      END,
      CASE best_battery.chemistry
        WHEN 'Lithium' THEN ARRAY['10+ year lifespan', 'No maintenance', 'Fast charging', '95% efficiency']
        WHEN 'AGM' THEN ARRAY['No maintenance', '5-7 year lifespan', 'Reliable', 'Good performance']  
        WHEN 'Flooded' THEN ARRAY['Lowest upfront cost', 'High capacity', 'Proven technology', 'Repairable']
        ELSE ARRAY['Standard battery']
      END;
  END IF;
END;
$$;
