import type { EngineOption, SelectedVehicle } from "../types";
import { formatFuelTypeLabel, inferFuelTypeFromText, normalizeFuelType } from "./fuelType";

export function normalizeEngineOption(option: unknown, vehicle?: Partial<SelectedVehicle>): EngineOption {
  const raw = typeof option === "string" ? { label: option, value: option } : (option || {}) as any;
  const label = String(raw.label || raw.value || raw.engine || "").trim();
  const value = String(raw.value || label).trim();
  const inferred = inferFuelTypeFromText(label, raw.engineCode, raw.engine_code, vehicle?.trim, vehicle?.model);
  const fuelType = normalizeFuelType(raw.fuelType || raw.fuel_type || inferred.fuelType);

  return {
    label,
    value,
    engineCode: raw.engineCode || raw.engine_code || "",
    fuelType,
    confidence: raw.confidence || inferred.confidence,
    source: raw.source || "engineOption",
    verified: Boolean(raw.verified),
    notes: raw.notes || "",
  };
}

export function formatEngineOptionLabel(option: EngineOption): string {
  const label = option.label || option.value || "Unknown engine";
  const lower = label.toLowerCase();
  if (["diesel", "gasoline", "flex fuel", "flexfuel", "hybrid", "electric", "e85"].some((term) => lower.includes(term))) {
    return label;
  }
  if (option.fuelType === "unknown") return `${label}, fuel type unknown`;
  return `${label}, ${formatFuelTypeLabel(option.fuelType)}`;
}
