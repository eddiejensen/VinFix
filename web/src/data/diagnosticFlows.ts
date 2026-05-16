import type { FuelType } from "../types";

export interface FlowSummary {
  id: string;
  title: string;
  category: string;
  description: string;
  fuelTypes: FuelType[];
  codes: string[];
  firstChecks: string[];
  commonSignals: string[];
  nodes: Record<string, FlowNode>;
}

export interface FlowNode {
  question?: string;
  yes?: string;
  no?: string;
  notSure?: string;
  skip?: string;
  resultTitle?: string;
  likelyCauses?: string[];
  nextBestChecks?: string[];
}

export const flowSummaries: FlowSummary[] = [
  makeFlow("crankNoStart", "Crank No Start", "Starting", "Engine cranks but will not start.", ["gasoline", "diesel", "hybrid", "flex_fuel"], ["P0335", "P0230"], ["Check RPM signal while cranking", "Check fuel pressure", "Check spark or injector command"], ["fuel pump", "crank sensor", "security", "low compression"]),
  makeFlow("noCrankNoStart", "No Crank No Start", "Starting", "Starter does not crank the engine.", ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], [], ["Check battery voltage", "Try neutral", "Check starter relay and command"], ["battery", "starter", "neutral safety", "main fuse"]),
  makeFlow("randomMisfire", "Random Misfire", "Engine", "P0300 or multiple cylinder misfires.", ["gasoline", "hybrid", "flex_fuel"], ["P0300"], ["Check fuel trims", "Smoke test intake", "Check ignition and fuel pressure"], ["vacuum leak", "coil", "injector", "low fuel pressure"]),
  makeFlow("roughIdle", "Rough Idle", "Engine", "Shaking or unstable idle at stop.", ["gasoline", "diesel", "hybrid", "flex_fuel"], ["P0171", "P0300"], ["Check trims at idle", "Inspect intake leaks", "Check throttle body"], ["vacuum leak", "dirty throttle", "misfire", "EGR issue"]),
  makeFlow("stallingWhileDriving", "Stalling While Driving", "Engine", "Engine shuts off while moving or at stops.", ["gasoline", "diesel", "hybrid", "flex_fuel"], ["P0335", "P0340"], ["Check live RPM dropout", "Check fuel pressure during stall", "Inspect grounds and relays"], ["crank sensor", "fuel pump", "main relay", "charging issue"]),
  makeFlow("blownFuse", "Blown Fuse", "Electrical", "A fuse repeatedly opens after replacement.", ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], [], ["Identify fuse circuit", "Inspect recent work", "Measure short to ground"], ["shorted wiring", "failed motor", "water intrusion", "wrong fuse rating"]),
  makeFlow("batteryDrain", "Battery Drain", "Electrical", "Battery dies after sitting.", ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], [], ["Load test battery", "Check charging voltage", "Measure parasitic draw"], ["weak battery", "module staying awake", "alternator diode", "aftermarket accessory"]),
  makeFlow("overheating", "Overheating", "Cooling", "Temperature climbs or coolant boils over.", ["gasoline", "diesel", "hybrid", "flex_fuel"], ["P0128", "P0480"], ["Check coolant level", "Confirm fan operation", "Pressure test cooling system"], ["coolant leak", "thermostat", "fan fault", "head gasket"]),
  makeFlow("acNotCold", "AC Not Cold", "HVAC", "AC blows warm or weak cooling.", ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], [], ["Check compressor command", "Check pressures", "Check condenser airflow"], ["low refrigerant", "compressor fault", "blend door", "condenser airflow"]),
  makeFlow("evapCode", "EVAP Code", "Emissions", "EVAP leak, purge, or vent codes.", ["gasoline", "hybrid", "flex_fuel"], ["P0440", "P0442", "P0449"], ["Check cap", "Test purge valve", "Test vent valve and wiring"], ["gas cap", "purge valve", "vent valve", "EVAP leak"]),
  makeFlow("leanCode", "Lean Code", "Fuel Trim", "Lean fuel trim codes or positive trims.", ["gasoline", "hybrid", "flex_fuel"], ["P0171", "P0174"], ["Smoke test intake", "Check MAF data", "Check fuel pressure"], ["vacuum leak", "MAF sensor", "weak pump", "exhaust leak"]),
  makeFlow("richCode", "Rich Code", "Fuel Trim", "Rich fuel trim codes or negative trims.", ["gasoline", "hybrid", "flex_fuel"], ["P0172", "P0175"], ["Check fuel pressure", "Inspect injector leakdown", "Check MAF and oxygen sensors"], ["leaking injector", "high fuel pressure", "MAF error", "EVAP purge stuck"]),
  makeFlow("absLight", "ABS Light", "Brakes", "ABS, traction, or stability light is on.", ["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"], [], ["Scan ABS module", "Inspect wheel speed sensors", "Check wheel bearing play"], ["wheel speed sensor", "hub bearing", "ABS wiring", "module power"]),
  makeFlow("transmissionSlipping", "Transmission Slipping", "Drivetrain", "RPM rises without matching vehicle speed.", ["gasoline", "diesel", "hybrid", "flex_fuel"], ["P0700", "P0730"], ["Check fluid level and condition", "Scan transmission codes", "Road test slip event"], ["low fluid", "worn clutches", "solenoid fault", "torque converter"])
];

export function visibleFlowsForFuel(fuelType: FuelType | undefined) {
  if (!fuelType || fuelType === "unknown") return flowSummaries;
  return flowSummaries.filter((flow) => flow.fuelTypes.includes(fuelType) || flow.fuelTypes.includes("unknown"));
}

function makeFlow(
  id: string,
  title: string,
  category: string,
  description: string,
  fuelTypes: FuelType[],
  codes: string[],
  firstChecks: string[],
  commonSignals: string[]
): FlowSummary {
  return {
    id,
    title,
    category,
    description,
    fuelTypes,
    codes,
    firstChecks,
    commonSignals,
    nodes: {
      start: {
        question: "Can you reproduce the symptom right now?",
        yes: "scan",
        no: "intermittent",
        notSure: "scan",
        skip: "scan",
      },
      scan: {
        question: "Are there diagnostic trouble codes or warning lights related to this symptom?",
        yes: "codes",
        no: "basics",
        notSure: "basics",
        skip: "basics",
      },
      codes: {
        question: "Do the codes point to the same system as the symptom?",
        yes: "targeted",
        no: "basics",
        notSure: "targeted",
        skip: "targeted",
      },
      basics: {
        question: "Do basic checks show a clear problem such as low fluid, low voltage, leak, loose connector, or blown fuse?",
        yes: "basicResult",
        no: "targeted",
        notSure: "targeted",
        skip: "targeted",
      },
      targeted: {
        question: "Does a targeted test fail for one of the first checks below?",
        yes: "confirmed",
        no: "deeper",
        notSure: "deeper",
        skip: "deeper",
      },
      intermittent: {
        resultTitle: "Intermittent symptom",
        likelyCauses: ["Heat or vibration related wiring fault", "Relay or module dropout", "Component failing only under load"],
        nextBestChecks: ["Record freeze frame and conditions", "Wiggle-test harnesses safely", "Check service bulletins for intermittent faults"],
      },
      basicResult: {
        resultTitle: "Basic fault found",
        likelyCauses: ["Low fluid or voltage", "Loose or corroded connector", "Fuse, relay, or visible leak issue"],
        nextBestChecks: ["Repair the visible fault first", "Clear codes and retest", "Confirm the symptom is gone before replacing parts"],
      },
      confirmed: {
        resultTitle: "Likely cause narrowed",
        likelyCauses: commonSignals,
        nextBestChecks: firstChecks,
      },
      deeper: {
        resultTitle: "Needs deeper testing",
        likelyCauses: commonSignals,
        nextBestChecks: ["Use service information for pin tests", "Compare live data to known-good values", "Avoid parts replacement until a test fails"],
      },
    },
  };
}
