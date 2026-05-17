import type { SelectedVehicle } from "../types";

interface RockAutoVehicleMapping {
  makeSlug: string;
  year: string;
  modelSlug: string;
  engineSlug: string;
  vehicleCode: string;
}

const rockAutoVehicleMap: Record<string, RockAutoVehicleMapping> = {
  "2003|chevrolet|silverado 1500|5.3l v8": {
    makeSlug: "chevrolet",
    year: "2003",
    modelSlug: "silverado+1500",
    engineSlug: "5.3l+v8",
    vehicleCode: "1412086",
  },
  "2003|chevrolet|silverado 1500|5.3l v8 flex fuel": {
    makeSlug: "chevrolet",
    year: "2003",
    modelSlug: "silverado+1500",
    engineSlug: "5.3l+v8",
    vehicleCode: "1412086",
  },
};

function normalizeKeySegment(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function slugifyCatalogSegment(value: unknown) {
  return normalizeKeySegment(value).replace(/\s+/g, "+");
}

function slugifyCategory(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "+");
}

function vehicleMapKey(vehicle: Pick<SelectedVehicle, "year" | "make" | "model" | "engine">) {
  return [
    normalizeKeySegment(vehicle.year),
    normalizeKeySegment(vehicle.make),
    normalizeKeySegment(vehicle.model),
    normalizeKeySegment(vehicle.engine),
  ].join("|");
}

export function getRockAutoVehicleMapping(vehicle: SelectedVehicle | null) {
  if (!vehicle?.year || !vehicle.make || !vehicle.model || !vehicle.engine) return null;
  return rockAutoVehicleMap[vehicleMapKey(vehicle)] || null;
}

export function buildRockAutoCatalogUrl(vehicle: SelectedVehicle | null, category: string) {
  const mapping = getRockAutoVehicleMapping(vehicle);
  if (!mapping) return null;

  return `https://www.rockauto.com/en/catalog/${[
    mapping.makeSlug || slugifyCatalogSegment(vehicle?.make),
    mapping.year,
    mapping.modelSlug || slugifyCatalogSegment(vehicle?.model),
    mapping.engineSlug || slugifyCatalogSegment(vehicle?.engine),
    mapping.vehicleCode,
    slugifyCategory(category),
  ].join(",")}`;
}
