-- Fix the calculate_panel_system function to handle quantity correctly
CREATE OR REPLACE FUNCTION public.calculate_panel_system(daytime_load_watts integer, night_energy_kwh double precision, state_name text, sun_hours_per_day double precision DEFAULT 5.0, preferred_panel_model text DEFAULT NULL::text)
 RETURNS TABLE(panel_id uuid, model_name text, rated_power integer, recommended_quantity integer, total_watts integer, total_cost integer, daily_generation_kwh double precision, derating_factor double precision, calculation_breakdown jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  battery_charging_requirement INTEGER;
  total_power_requirement INTEGER;
  adjusted_power_requirement INTEGER;
  panel_record RECORD;
  best_panel RECORD;
  best_quantity INTEGER;
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
      best_quantity := required_quantity;
    END IF;
  END LOOP;
  
  -- Return the best panel configuration
  IF best_panel IS NOT NULL THEN
    RETURN QUERY SELECT
      best_panel.id,
      best_panel.model_name,
      best_panel.rated_power,
      best_quantity,
      (best_quantity * best_panel.rated_power)::INTEGER,
      (best_quantity * best_panel.unit_cost)::INTEGER,
      ROUND(((best_quantity * best_panel.rated_power * best_panel.derating_factor * sun_hours) / 1000)::NUMERIC, 1)::FLOAT,
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
$function$;