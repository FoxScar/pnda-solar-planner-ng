
-- Create calculate_battery_system RPC function
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
  
  -- Return the best battery configuration
  IF best_battery IS NOT NULL THEN
    RETURN QUERY SELECT
      best_battery.id,
      best_battery.chemistry,
      best_battery.voltage,
      best_battery.capacity_kwh,
      best_battery.needed_quantity,
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

-- Create calculate_panel_system RPC function
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
      ROUND(((best_panel.needed_quantity * best_panel.rated_power * best_panel.derating_factor * sun_hours_per_day) / 1000)::NUMERIC, 1)::FLOAT,
      best_panel.derating_factor;
  END IF;
END;
$$;

-- Create calculate_complete_system RPC function
CREATE OR REPLACE FUNCTION calculate_complete_system(
  appliances_data JSONB,
  state_name TEXT,
  preferences JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  daily_energy_kwh FLOAT,
  peak_load_watts INTEGER,
  recommended_inverter JSONB,
  recommended_battery JSONB,
  recommended_panels JSONB,
  total_system_cost INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_daily_energy FLOAT := 0;
  total_peak_load INTEGER := 0;
  appliance JSONB;
  inverter_result RECORD;
  battery_result RECORD;
  panel_result RECORD;
  system_cost INTEGER := 0;
BEGIN
  -- Calculate energy needs from appliances
  FOR appliance IN SELECT * FROM jsonb_array_elements(appliances_data)
  LOOP
    total_daily_energy := total_daily_energy + 
      ((appliance->>'power')::INTEGER * (appliance->>'quantity')::INTEGER * (appliance->>'hoursPerDay')::INTEGER) / 1000.0;
    total_peak_load := total_peak_load + 
      ((appliance->>'power')::INTEGER * (appliance->>'quantity')::INTEGER);
  END LOOP;
  
  -- Get inverter recommendation
  SELECT * INTO inverter_result FROM calculate_inverter(total_peak_load);
  
  -- Get battery recommendation
  SELECT * INTO battery_result FROM calculate_battery_system(
    total_daily_energy,
    COALESCE(preferences->>'preferred_chemistry', NULL)::TEXT
  );
  
  -- Get panel recommendation  
  SELECT * INTO panel_result FROM calculate_panel_system(
    total_daily_energy,
    state_name,
    COALESCE(preferences->>'preferred_panel_model', NULL)::TEXT
  );
  
  -- Calculate total system cost
  system_cost := COALESCE(inverter_result.unit_cost, 0) + 
                 COALESCE(battery_result.total_cost, 0) + 
                 COALESCE(panel_result.total_cost, 0);
  
  RETURN QUERY SELECT
    total_daily_energy,
    total_peak_load,
    jsonb_build_object(
      'id', inverter_result.id,
      'model_name', inverter_result.model_name,
      'kva_rating', inverter_result.kva_rating,
      'voltage_bus', inverter_result.voltage_bus,
      'surge_capacity', inverter_result.surge_capacity,
      'unit_cost', inverter_result.unit_cost
    ),
    jsonb_build_object(
      'id', battery_result.battery_id,
      'chemistry', battery_result.chemistry,
      'configuration', battery_result.configuration,
      'total_capacity_kwh', battery_result.total_capacity_kwh,
      'total_cost', battery_result.total_cost,
      'pros', battery_result.pros
    ),
    jsonb_build_object(
      'id', panel_result.panel_id,
      'model_name', panel_result.model_name,
      'quantity', panel_result.recommended_quantity,
      'total_watts', panel_result.total_watts,
      'total_cost', panel_result.total_cost,
      'daily_generation_kwh', panel_result.daily_generation_kwh
    ),
    system_cost;
END;
$$;

-- Create generate_quote_data RPC function
CREATE OR REPLACE FUNCTION generate_quote_data(
  selected_components JSONB
)
RETURNS TABLE (
  inverter_cost INTEGER,
  battery_cost INTEGER,
  panel_cost INTEGER,
  subtotal INTEGER,
  installation_cost INTEGER,
  total_cost INTEGER,
  quote_details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  inv_cost INTEGER := 0;
  bat_cost INTEGER := 0;
  pan_cost INTEGER := 0;
  sub_total INTEGER;
  install_cost INTEGER;
  final_total INTEGER;
BEGIN
  -- Extract costs from selected components
  inv_cost := COALESCE((selected_components->'inverter'->>'unit_cost')::INTEGER, 0);
  bat_cost := COALESCE((selected_components->'battery'->>'total_cost')::INTEGER, 0);
  pan_cost := COALESCE((selected_components->'panels'->>'total_cost')::INTEGER, 0);
  
  -- Calculate totals
  sub_total := inv_cost + bat_cost + pan_cost;
  install_cost := ROUND(sub_total * 0.15); -- 15% installation cost
  final_total := sub_total + install_cost;
  
  RETURN QUERY SELECT
    inv_cost,
    bat_cost,
    pan_cost,
    sub_total,
    install_cost,
    final_total,
    jsonb_build_object(
      'inverter', selected_components->'inverter',
      'battery', selected_components->'battery',
      'panels', selected_components->'panels',
      'pricing', jsonb_build_object(
        'subtotal', sub_total,
        'installation', install_cost,
        'total', final_total
      ),
      'generated_at', NOW()
    );
END;
$$;

-- Create get_appliances_by_category helper function
CREATE OR REPLACE FUNCTION get_appliances_by_category(category_filter TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  power_rating INTEGER,
  category TEXT,
  is_energy_efficient BOOLEAN
)
LANGUAGE sql
AS $$
  SELECT id, name, power_rating, category, is_energy_efficient
  FROM appliances
  WHERE category = category_filter
  ORDER BY power_rating ASC;
$$;
