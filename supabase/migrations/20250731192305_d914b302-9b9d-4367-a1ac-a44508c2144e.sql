-- Update calculate_lithium_battery_options to filter by system voltage
CREATE OR REPLACE FUNCTION public.calculate_lithium_battery_options(
  night_energy_kwh double precision, 
  system_voltage integer DEFAULT 24,
  night_duration_hours integer DEFAULT 13
)
RETURNS TABLE(
  battery_id uuid, 
  chemistry text, 
  voltage integer, 
  capacity_kwh double precision, 
  recommended_quantity integer, 
  total_capacity_kwh double precision, 
  total_cost integer, 
  configuration text, 
  pros text[], 
  is_optimal boolean
)
LANGUAGE plpgsql
AS $function$
DECLARE
  battery_record RECORD;
  min_cost INTEGER := 999999999;
  optimal_config RECORD;
BEGIN
  -- First pass: find the most cost-effective configuration for matching voltage
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.capacity_kwh * b.efficiency * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND b.chemistry = 'Lithium'
      AND b.voltage = system_voltage  -- Only match exact voltage for lithium
    ORDER BY b.capacity_kwh ASC
  LOOP
    IF (battery_record.needed_quantity * battery_record.unit_cost) < min_cost THEN
      min_cost := battery_record.needed_quantity * battery_record.unit_cost;
      optimal_config := battery_record;
    END IF;
  END LOOP;
  
  -- Second pass: return all viable lithium options with exact voltage match
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.capacity_kwh * b.efficiency * b.dod)) as needed_quantity
    FROM batteries b
    WHERE b.available = true
      AND b.chemistry = 'Lithium'
      AND b.voltage = system_voltage  -- Only match exact voltage for lithium
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
      battery_record.needed_quantity || ' × ' || battery_record.capacity_kwh || 'kWh @ ' || battery_record.voltage || 'V Lithium',
      ARRAY['10+ year lifespan', 'No maintenance', 'Fast charging', '85% round-trip efficiency'],
      (battery_record.id = optimal_config.id) as is_optimal;
  END LOOP;
END;
$function$

-- Update calculate_traditional_battery_system to handle voltage configuration
CREATE OR REPLACE FUNCTION public.calculate_traditional_battery_system(
  night_energy_kwh double precision, 
  preferred_chemistry text, 
  system_voltage integer DEFAULT 24,
  night_duration_hours integer DEFAULT 13
)
RETURNS TABLE(
  battery_id uuid, 
  chemistry text, 
  voltage integer, 
  capacity_kwh double precision, 
  recommended_quantity integer, 
  total_capacity_kwh double precision, 
  total_cost integer, 
  configuration text, 
  pros text[]
)
LANGUAGE plpgsql
AS $function$
DECLARE
  battery_record RECORD;
  best_battery RECORD;
  min_cost INTEGER := 999999999;
  voltage_multiplier INTEGER;
  series_batteries INTEGER;
  parallel_strings INTEGER;
  total_batteries INTEGER;
BEGIN
  -- Find the best traditional battery option with voltage configuration
  FOR battery_record IN
    SELECT b.*, 
           CEIL(night_energy_kwh / (b.capacity_kwh * b.efficiency * b.dod)) as base_quantity
    FROM batteries b
    WHERE b.available = true
      AND b.chemistry = preferred_chemistry
    ORDER BY b.capacity_kwh ASC
  LOOP
    -- Calculate voltage configuration needed
    voltage_multiplier := system_voltage / battery_record.voltage;
    
    -- For traditional batteries, we can configure voltage via series/parallel
    IF voltage_multiplier >= 1 THEN
      series_batteries := voltage_multiplier;
      parallel_strings := CEIL(battery_record.base_quantity::FLOAT / series_batteries);
      total_batteries := series_batteries * parallel_strings;
      
      IF (total_batteries * battery_record.unit_cost) < min_cost THEN
        min_cost := total_batteries * battery_record.unit_cost;
        best_battery := battery_record;
        best_battery.calculated_series := series_batteries;
        best_battery.calculated_parallel := parallel_strings;
        best_battery.calculated_total := total_batteries;
      END IF;
    END IF;
  END LOOP;
  
  -- Return the best option with voltage configuration
  IF best_battery IS NOT NULL THEN
    RETURN QUERY SELECT
      best_battery.id,
      best_battery.chemistry,
      system_voltage, -- Return system voltage, not battery voltage
      (best_battery.calculated_total * best_battery.capacity_kwh)::FLOAT,
      best_battery.calculated_total::INTEGER,
      (best_battery.calculated_total * best_battery.capacity_kwh)::FLOAT,
      (best_battery.calculated_total * best_battery.unit_cost)::INTEGER,
      CASE 
        WHEN best_battery.calculated_series = 1 THEN
          best_battery.calculated_parallel || ' × ' || ROUND((best_battery.capacity_kwh * 1000 / best_battery.voltage)::NUMERIC, 0) || 'Ah @ ' || best_battery.voltage || 'V ' || best_battery.chemistry
        WHEN best_battery.calculated_parallel = 1 THEN
          best_battery.calculated_series || ' × ' || ROUND((best_battery.capacity_kwh * 1000 / best_battery.voltage)::NUMERIC, 0) || 'Ah @ ' || best_battery.voltage || 'V in series = ' || system_voltage || 'V'
        ELSE
          best_battery.calculated_total || ' × ' || ROUND((best_battery.capacity_kwh * 1000 / best_battery.voltage)::NUMERIC, 0) || 'Ah (' || best_battery.calculated_series || 'S' || best_battery.calculated_parallel || 'P) = ' || system_voltage || 'V'
      END,
      CASE best_battery.chemistry
        WHEN 'AGM' THEN ARRAY['No maintenance', '5-7 year lifespan', 'Reliable', 'Good performance']  
        WHEN 'Flooded' THEN ARRAY['Lowest upfront cost', 'High capacity', 'Proven technology', 'Repairable']
        ELSE ARRAY['Standard battery']
      END;
  END IF;
END;
$function$