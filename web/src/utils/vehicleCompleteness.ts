import type { SelectedVehicle } from "../types";

export function isVehicleComplete(vehicle: SelectedVehicle | null) {
  return Boolean(vehicle?.year && vehicle?.make && vehicle?.model && vehicle?.engine?.trim());
}

export function vehicleCompletenessScore(vehicle: SelectedVehicle | null) {
  if (!vehicle) return { complete: 0, total: 6, label: "No vehicle selected" };
  const fields = [
    Boolean(vehicle.year),
    Boolean(vehicle.make),
    Boolean(vehicle.model),
    Boolean(vehicle.trim),
    Boolean(vehicle.engine),
    Boolean(vehicle.drivetrain),
  ];
  const complete = fields.filter(Boolean).length;
  return {
    complete,
    total: fields.length,
    label: `Vehicle setup, ${complete} of ${fields.length} complete`,
  };
}

export function vehicleSummaryLine(vehicle: SelectedVehicle) {
  if (vehicle.engine) {
    return [vehicle.engine, vehicle.drivetrain].filter(Boolean).join(", ");
  }
  return "Select the engine so results match your exact vehicle.";
}
