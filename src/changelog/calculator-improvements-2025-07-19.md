# Calculator Improvements - Component Updates & Merging Logic
**Date:** 2025-07-19
**Type:** Feature Enhancement

## Overview
Updated the solar calculator with correct component sizes and implemented merging logic for inverters and lithium batteries while hiding calculation details from users.

## Database Changes
### Inverters
- **Removed**: 2.5kVA, 3.5kVA, 7.5kVA, 10kVA inverters
- **Added**: 2kVA, 3kVA, 4kVA, 6kVA, 8kVA, 12kVA inverters
- **Implemented**: Merging logic for inverters >5kVA (e.g., 2×5kVA = 10kVA)

### Batteries
- **Lithium - Removed**: 2.4kWh option
- **Lithium - Added**: 12kWh, 14kWh, 15kWh, 17kWh options
- **Implemented**: Multiple configuration options with user choice of starting battery size
- **Maintained**: AGM and Flooded battery systems without merging

### Solar Panels
- **Added**: 400W, 500W, 600W monocrystalline panels
- **Confirmed**: 590W panel already existed

## New Database Functions
- `calculate_inverter_with_merging()`: Handles single and merged inverter configurations
- `calculate_lithium_battery_options()`: Shows multiple lithium battery configurations
- `calculate_traditional_battery_system()`: Handles AGM/Flooded batteries

## User Experience Improvements
- **Hidden Calculations**: Removed detailed calculation breakdowns from UI
- **Simplified Selection**: Focus on component choices rather than technical formulas
- **Smart Recommendations**: Background calculations for accuracy without complexity
- **Merging Options**: Clear presentation of single vs merged configurations

## Business Logic
- Inverters can only be merged from 5kVA upwards
- Lithium batteries offer multiple starting size options
- AGM/Flooded batteries remain single-unit recommendations
- Cost comparison between different configurations
- Maintains technical accuracy while hiding complexity

## Next Steps
- Update UI components to use new database functions
- Implement streamlined component selection interface
- Add configuration comparison features
- Test merging calculations and recommendations