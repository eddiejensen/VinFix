import type { SelectedVehicle, VehicleImage } from "../types";

function extractYears(value: unknown): number[] {
  return (String(value || "").match(/(19[5-9]\d|20[0-4]\d)/g) || [])
    .map((year) => Number.parseInt(year, 10))
    .filter(Boolean);
}

export function isVehicleImageCompatible(vehicle: SelectedVehicle, image: VehicleImage | null): boolean {
  if (!image) return false;

  const requestedYear = Number.parseInt(String(vehicle.year || ""), 10);
  const normalizedMake = String(vehicle.make || "").toLowerCase();
  const normalizedModel = String(vehicle.model || "").toLowerCase();
  const foundYears = [
    image.title,
    image.imageUrl,
    image.thumbnailUrl,
    image.attributionUrl,
  ].flatMap(extractYears);

  if (!requestedYear || foundYears.length === 0) {
    return true;
  }

  if (
    requestedYear >= 2000 &&
    requestedYear <= 2006 &&
    normalizedMake === "chevrolet" &&
    normalizedModel.includes("suburban")
  ) {
    return foundYears.some((year) => year >= 2000 && year <= 2006);
  }

  return foundYears.some((year) => Math.abs(year - requestedYear) <= 3);
}
