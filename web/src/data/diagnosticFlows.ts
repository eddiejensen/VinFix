import type { FuelType } from "../types";

export interface FlowSummary {
  id: string;
  title: string;
  category: string;
  description: string;
  fuelTypes: FuelType[];
  codes: string[];
  firstChecks: string[];
}

export const flowSummaries: FlowSummary[] = [
  { id: "crankNoStart", title: "Crank no start", category: "Starting", description: "Engine cranks but will not start.", fuelTypes: ["gasoline", "diesel", "hybrid", "flex_fuel"], codes: ["P0335", "P0230"], firstChecks: ["Check RPM signal while cranking", "Check fuel pressure", "Check spark or injector command"] },
  { id: "noCrankNoStart", title: "No crank no start", category: "Starting", description: "Starter does not crank the engine.", fuelTypes: ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], codes: [], firstChecks: ["Check battery voltage", "Try neutral", "Check starter relay and command"] },
  { id: "randomMisfire", title: "Random misfire", category: "Engine", description: "P0300 or multiple cylinder misfires.", fuelTypes: ["gasoline", "hybrid", "flex_fuel"], codes: ["P0300"], firstChecks: ["Check fuel trims", "Smoke test intake", "Check ignition and fuel pressure"] },
  { id: "evapCode", title: "EVAP code", category: "Emissions", description: "EVAP leak, purge, or vent codes.", fuelTypes: ["gasoline", "hybrid", "flex_fuel"], codes: ["P0440", "P0442", "P0449"], firstChecks: ["Check cap", "Test purge valve", "Test vent valve and wiring"] },
  { id: "batteryDrain", title: "Battery drain", category: "Electrical", description: "Battery dies after sitting.", fuelTypes: ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], codes: [], firstChecks: ["Load test battery", "Check charging voltage", "Measure parasitic draw"] },
  { id: "acNotCold", title: "AC not cold", category: "HVAC", description: "AC blows warm or weak cooling.", fuelTypes: ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], codes: [], firstChecks: ["Check compressor command", "Check pressures", "Check condenser airflow"] },
  { id: "evReducedPower", title: "EV reduced power", category: "Electric", description: "EV has reduced power or warning messages.", fuelTypes: ["electric", "plug_in_hybrid"], codes: [], firstChecks: ["Check 12V battery", "Check charging alerts", "Scan HV system"] },
  { id: "dieselLowPower", title: "Diesel low power", category: "Diesel", description: "Diesel lacks power or boost.", fuelTypes: ["diesel"], codes: [], firstChecks: ["Check fuel filter", "Check boost leaks", "Check DPF or regen status"] }
];

export function visibleFlowsForFuel(fuelType: FuelType | undefined) {
  if (!fuelType || fuelType === "unknown") return flowSummaries;
  return flowSummaries.filter((flow) => flow.fuelTypes.includes(fuelType) || flow.fuelTypes.includes("unknown"));
}
