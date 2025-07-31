// Complete solar system sizing calculations
// Based on comprehensive algorithm for Nigerian solar systems

interface Appliance {
  type?: string;
  name?: string;
  power?: number;
  power_rating?: number;
  quantity: number;
  hours?: number;
  hoursPerDay?: number;
  timeOfUse?: 'Day' | 'Night' | 'Both';
  period?: 'day' | 'night' | 'both';
}

interface CustomBattery {
  ah?: number;
  voltage?: number;
}

interface SolarSystemResult {
  // Load summary
  totalLoadW: number;
  dayLoadWh: number;
  nightLoadWh: number;
  totalDailyEnergyWh: number;
  
  // Component recommendations
  inverterKva: string;
  batteryConfig: string;
  numPanels: number;
  panelWatt: number;
  
  // Detailed calculations
  calculations: {
    minInverterKva: number;
    batteryCapacityAh: number;
    batteryRechargeLoad: number;
    peakSunHours: number;
    systemEfficiency: number;
    powerFactor: number;
    surgeMargin: number;
    dod: number;
    efficiency: number;
    autonomyHours: number;
  };
}

// Standard appliance power ratings (Watts)
const APPLIANCES: { [key: string]: number } = {
  'LED Bulb': 10,
  'CFL Bulb': 18,
  'Incandescent Bulb': 60,
  'Ceiling Fan': 75,
  'Table Fan': 50,
  'Standing Fan': 65,
  'Refrigerator (Single Door)': 150,
  'Refrigerator (Double Door)': 250,
  'Freezer (Small)': 200,
  'Freezer (Large)': 350,
  'TV (32" LED)': 65,
  'TV (43" LED)': 85,
  'TV (55" LED)': 120,
  'Laptop': 65,
  'Desktop Computer': 200,
  'Phone Charger': 10,
  'Radio': 20,
  'Iron': 1200,
  'Microwave': 800,
  'Blender': 400,
  'Water Pump': 750,
  'Air Conditioner (1HP)': 900,
  'Air Conditioner (1.5HP)': 1350,
  'Washing Machine': 500,
  'Electric Kettle': 1500,
  'Rice Cooker': 300,
  'Home Theater': 150,
  'Security Camera': 12,
  'Router/Modem': 15
};

// Battery options (Ah @ Voltage)
const BATTERY_OPTIONS = [
  { ah: 100, voltage: 12, type: 'AGM' },
  { ah: 150, voltage: 12, type: 'AGM' },
  { ah: 200, voltage: 12, type: 'AGM' },
  { ah: 220, voltage: 12, type: 'Flooded' },
  { ah: 100, voltage: 24, type: 'Lithium' },
  { ah: 200, voltage: 24, type: 'Lithium' }
];

// Inverter options
const INVERTER_OPTIONS = [
  { kva: 1.5, label: '1.5kVA' },
  { kva: 2.5, label: '2.5kVA' },
  { kva: 3.5, label: '3.5kVA' },
  { kva: 5.0, label: '5kVA' },
  { kva: 7.5, label: '7.5kVA' },
  { kva: 10.0, label: '10kVA' },
  { kva: 15.0, label: '15kVA' },
  { kva: 20.0, label: '20kVA' }
];

/**
 * Calculate solar system sizing based on appliances and usage
 * @param appliances - Array of appliance objects with {type, quantity, hours, timeOfUse}
 * @param customBattery - Custom battery specs {ah, voltage}
 * @param customInverter - Custom inverter size
 * @returns Complete system sizing results
 */
export function calculateSolarSystem(
  appliances: Appliance[], 
  customBattery: CustomBattery = {}, 
  customInverter: string = ''
): SolarSystemResult {
  // Calculate total loads
  let dayLoad = 0; // Wh (Watt-hours)
  let nightLoad = 0; // Wh
  let totalLoad = 0; // W (Watts - instantaneous power)

  appliances.forEach(app => {
    // Get power rating from different possible field names
    const applianceName = app.type || app.name || '';
    const power = app.power || app.power_rating || APPLIANCES[applianceName] || 0;
    const quantity = app.quantity || 1;
    const hours = app.hours || app.hoursPerDay || 0;
    const timeOfUse = app.timeOfUse || app.period || 'both';

    if (!power) return;

    const totalPower = power * quantity; // Total watts for this appliance
    const dailyEnergy = totalPower * hours; // Daily energy consumption in Wh

    // Distribute energy based on time of use
    if (timeOfUse === 'Day' || timeOfUse === 'day') {
      dayLoad += dailyEnergy;
    } else if (timeOfUse === 'Night' || timeOfUse === 'night') {
      nightLoad += dailyEnergy;
    } else {
      // Both
      dayLoad += dailyEnergy / 2;
      nightLoad += dailyEnergy / 2;
    }

    totalLoad += totalPower; // Add to instantaneous load
  });

  // INVERTER SIZING
  const powerFactor = 0.8; // Typical power factor for mixed loads
  const surgeMargin = 1.5; // 50% surge margin for motor starting
  const minInverterKva = (totalLoad * surgeMargin) / (powerFactor * 1000);

  // Select recommended inverter
  const recommendedInverter = customInverter || 
    INVERTER_OPTIONS.find(inv => inv.kva >= minInverterKva)?.label || 
    `${Math.ceil(minInverterKva)}kVA`;

  // BATTERY SIZING (18-hour autonomy for night load)
  const dod = 0.8; // Depth of discharge (80% for Li-ion)
  const efficiency = 0.9; // System efficiency (90%)
  const batteryVoltage = customBattery.voltage || 24; // Default 24V system
  const autonomyHours = 18; // Backup duration for night loads

  // Calculate required battery capacity in Ah
  const batteryCapacityAh = (nightLoad * autonomyHours) / (dod * efficiency * batteryVoltage);

  // Determine battery configuration
  let batteryConfig: string;
  if (customBattery.ah) {
    const numBatteries = Math.ceil(batteryCapacityAh / customBattery.ah);
    batteryConfig = `${numBatteries} × ${customBattery.ah}Ah @ ${customBattery.voltage}V`;
  } else {
    // Auto-select from available options
    const selectedBattery = BATTERY_OPTIONS.find(bat => bat.ah >= batteryCapacityAh) || 
      BATTERY_OPTIONS[BATTERY_OPTIONS.length - 1];
    const numBatteries = Math.ceil(batteryCapacityAh / selectedBattery.ah);
    batteryConfig = `${numBatteries} × ${selectedBattery.ah}Ah @ ${selectedBattery.voltage}V`;
  }

  // PANEL SIZING
  const peakSunHours = 5; // Average peak sun hours for Nigeria
  const systemEfficiency = 0.75; // Overall system efficiency (75%)
  const panelWatt = 300; // Standard panel wattage

  // Calculate energy needed to recharge batteries (night load over 18 hours)
  const batteryRechargeLoad = (nightLoad * 18) / efficiency;

  // Total daily energy requirement
  const totalDailyEnergy = dayLoad + batteryRechargeLoad;

  // Calculate number of panels needed
  const numPanels = Math.ceil(totalDailyEnergy / (panelWatt * peakSunHours * systemEfficiency));

  // Return complete sizing results
  return {
    // Load summary
    totalLoadW: totalLoad,
    dayLoadWh: dayLoad,
    nightLoadWh: nightLoad,
    totalDailyEnergyWh: totalDailyEnergy,

    // Component recommendations
    inverterKva: recommendedInverter,
    batteryConfig: batteryConfig,
    numPanels: numPanels,
    panelWatt: panelWatt,

    // Detailed calculations (for debugging/verification)
    calculations: {
      minInverterKva: minInverterKva,
      batteryCapacityAh: batteryCapacityAh,
      batteryRechargeLoad: batteryRechargeLoad,
      peakSunHours: peakSunHours,
      systemEfficiency: systemEfficiency,
      powerFactor: powerFactor,
      surgeMargin: surgeMargin,
      dod: dod,
      efficiency: efficiency,
      autonomyHours: autonomyHours
    }
  };
}

// Export constants for use in other modules
export { APPLIANCES, BATTERY_OPTIONS, INVERTER_OPTIONS };

/**
 * KEY FORMULAS REFERENCE:
 * 
 * 1. Inverter Sizing:
 * MinInverterKVA = (TotalLoad × SurgeMargin) / (PowerFactor × 1000)
 * 
 * 2. Battery Capacity:
 * BatteryAh = (NightLoad × AutonomyHours) / (DOD × Efficiency × Voltage)
 * 
 * 3. Panel Sizing:
 * NumPanels = TotalDailyEnergy / (PanelWatt × PeakSunHours × SystemEfficiency)
 * 
 * 4. Battery Recharge Energy:
 * RechargeEnergy = (NightLoad × AutonomyHours) / SystemEfficiency
 * 
 * CONSTANTS USED:
 * - Power Factor: 0.8 (typical for mixed loads)
 * - Surge Margin: 1.5 (50% extra for motor starting)
 * - DOD: 0.8 (80% depth of discharge for Li-ion batteries)
 * - System Efficiency: 0.9 (90% overall efficiency)
 * - Peak Sun Hours: 5 (average for Nigeria)
 * - Panel Efficiency: 0.75 (75% considering losses)
 * - Autonomy Hours: 18 (backup duration for night loads)
 */