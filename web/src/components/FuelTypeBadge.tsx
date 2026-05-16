import type { FuelType } from "../types";
import { formatFuelTypeLabel } from "../utils/fuelType";

export function FuelTypeBadge({ fuelType }: { fuelType?: FuelType | string }) {
  return <span className={`badge fuel ${fuelType || "unknown"}`}>{formatFuelTypeLabel(fuelType)}</span>;
}
