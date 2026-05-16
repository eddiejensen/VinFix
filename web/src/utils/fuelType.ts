import type { Confidence, FuelType } from "../types";

export function normalizeFuelType(value: unknown): FuelType {
  const normalized = String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "gas" || normalized === "petrol") return "gasoline";
  if (normalized === "phev" || normalized === "plug_in") return "plug_in_hybrid";
  if (normalized === "ev" || normalized === "bev") return "electric";
  if (normalized === "flex" || normalized === "flexfuel" || normalized === "e85") return "flex_fuel";
  if (["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"].includes(normalized)) {
    return normalized as FuelType;
  }
  return "unknown";
}

export function formatFuelTypeLabel(fuelType: FuelType | string | undefined): string {
  const labels: Record<FuelType, string> = {
    gasoline: "Gasoline",
    diesel: "Diesel",
    hybrid: "Hybrid",
    plug_in_hybrid: "Plug in hybrid",
    electric: "Electric",
    flex_fuel: "Flex fuel",
    unknown: "Unknown",
  };
  return labels[normalizeFuelType(fuelType)] || "Unknown";
}

export function inferFuelTypeFromText(...values: unknown[]): { fuelType: FuelType; confidence: Confidence; reason: string } {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (!text.trim()) return { fuelType: "unknown", confidence: "low", reason: "No engine data was available." };

  if (/plug[-\s]?in|phev|4xe/.test(text)) return { fuelType: "plug_in_hybrid", confidence: "high", reason: "Plug in hybrid wording found." };
  if (/dual motor|electric|bev|ev\b|battery electric|tesla|leaf|bolt ev|mach[-\s]?e/.test(text)) return { fuelType: "electric", confidence: "high", reason: "Electric wording found." };
  if (/diesel|duramax|power stroke|powerstroke|cummins|tdi|ecodiesel|bluetec|bluetech|cdi|dci|hdi|640d|335d|328d|xdrive35d/.test(text)) return { fuelType: "diesel", confidence: "high", reason: "Diesel wording, trim, or engine code found." };
  if (/hybrid|prius/.test(text)) return { fuelType: "hybrid", confidence: "high", reason: "Hybrid wording found." };
  if (/flex fuel|flex-fuel|flexfuel|e85|ffv/.test(text)) return { fuelType: "flex_fuel", confidence: "high", reason: "Flex fuel wording found." };
  if (/gasoline|petrol|gas engine|spark ignition|640i|650i|328i|330i|335i|528i|535i|550i/.test(text)) return { fuelType: "gasoline", confidence: "high", reason: "Gasoline wording or trim found." };

  if (/v6|v8|v10|v12|i3|i4|i5|i6|inline|cylinder|turbo/.test(text)) {
    return { fuelType: "unknown", confidence: "low", reason: "Cylinder layout alone does not confirm fuel type." };
  }

  return { fuelType: "unknown", confidence: "low", reason: "Fuel type could not be confidently inferred." };
}
