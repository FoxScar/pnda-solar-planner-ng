
-- Fix the calculate_panel_system function to properly handle required_quantity
CREATE OR REPLACE FUNCTION calculate_panel_system(
  daily_energy_kwh FLOAT,
  state_name TEXT,
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
  derating_factor FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  sun_hours_per_day FLOAT;
  panel_record RECORD;
  best_panel RECORD;
  best_quantity INTEGER;
  min_cost INTEGER := 999999999;
  required_quantity INTEGER;
BEGIN
  -- Get sun hours for the state
  SELECT hours INTO sun_hours_per_day FROM sun_hours WHERE state = state_name;
  IF sun_hours_per_day IS NULL THEN
    sun_hours_per_day := 5.0; -- Default fallback
  END IF;
  
  -- Find the best panel option
  FOR panel_record IN
    SELECT p.*
    FROM panels p
    WHERE p.available = true
      AND (preferred_panel_model IS NULL OR p.model_name = preferred_panel_model)
    ORDER BY p.model_name LIKE '%Monocrystalline%' DESC, -- Prefer monocrystalline
             p.rated_power DESC
  LOOP
    -- Calculate required quantity with 20% safety margin
    required_quantity := CEIL((daily_energy_kwh * 1.2) / ((panel_record.rated_power * panel_record.derating_factor * sun_hours_per_day) / 1000));
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
      best_quantity::INTEGER,
      (best_quantity * best_panel.rated_power)::INTEGER,
      (best_quantity * best_panel.unit_cost)::INTEGER,
      ROUND(((best_quantity * best_panel.rated_power * best_panel.derating_factor * sun_hours_per_day) / 1000)::NUMERIC, 1)::FLOAT,
      best_panel.derating_factor;
  END IF;
END;
$$;
