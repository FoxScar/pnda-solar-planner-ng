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
$function$;