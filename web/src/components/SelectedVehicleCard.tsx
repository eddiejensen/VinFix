import type { SelectedVehicle } from "../types";
import { FuelTypeBadge } from "./FuelTypeBadge";

export function vehicleName(vehicle: SelectedVehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
}

export function SelectedVehicleCard({ vehicle, compact = false }: { vehicle: SelectedVehicle | null; compact?: boolean }) {
  if (!vehicle) {
    return (
      <div className="selected-vehicle empty">
        <strong>No vehicle selected</strong>
        <span>Select a vehicle on the home page to unlock vehicle aware diagnosis.</span>
      </div>
    );
  }

  return (
    <div className={`selected-vehicle ${compact ? "compact" : ""}`}>
      <div>
        <span className="eyebrow">Selected vehicle</span>
        <h3>{vehicleName(vehicle)}</h3>
        <p>{[vehicle.engine, vehicle.transmission, vehicle.drivetrain].filter(Boolean).join(", ") || "Engine details not selected"}</p>
      </div>
      <FuelTypeBadge fuelType={vehicle.fuelType} />
    </div>
  );
}
