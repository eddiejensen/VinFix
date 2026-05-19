import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SelectedVehicle, VehicleImage } from "../types";
import { FuelTypeBadge } from "./FuelTypeBadge";
import { formatFuelTypeLabel } from "../utils/fuelType";
import { isVehicleImageCompatible } from "../utils/vehicleImages";
import { isVehicleComplete, vehicleCompletenessScore, vehicleSummaryLine } from "../utils/vehicleCompleteness";

export function vehicleName(vehicle: SelectedVehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
}

export function SelectedVehicleCard({ vehicle, compact = false }: { vehicle: SelectedVehicle | null; compact?: boolean }) {
  const [image, setImage] = useState<VehicleImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!vehicle?.year || !vehicle.make || !vehicle.model) {
      setImage(null);
      return;
    }

    api.image(vehicle)
      .then((result) => {
        if (!cancelled) {
          const nextImage = result.image || null;
          setImage(nextImage && isVehicleImageCompatible(vehicle, nextImage) ? nextImage : null);
        }
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]);

  if (!vehicle) {
    return (
      <div className="selected-vehicle empty">
        <strong>No vehicle selected</strong>
        <span>Select a vehicle to personalize diagnostics across AutoVinFix.</span>
        <Link className="secondary change-vehicle-link" to="/profile">Select vehicle</Link>
      </div>
    );
  }

  const complete = isVehicleComplete(vehicle);
  const progress = vehicleCompletenessScore(vehicle);

  return (
    <div className={`selected-vehicle ${compact ? "compact" : ""}`}>
      <div className="selected-vehicle-media">
        {image?.thumbnailUrl || image?.imageUrl ? (
          <img src={image.thumbnailUrl || image.imageUrl} alt={`Representative ${vehicleName(vehicle)}`} />
        ) : (
          <span>{vehicle.make?.slice(0, 1) || "V"}</span>
        )}
      </div>
      <div className="selected-vehicle-copy">
        <span className="eyebrow">Selected vehicle</span>
        <h3>{vehicleName(vehicle)}</h3>
        <p>{vehicleSummaryLine(vehicle)}</p>
        {!compact ? <p className="muted vehicle-progress">{progress.label}</p> : null}
        {!compact ? (
          <dl className="vehicle-detail-grid">
            <div><dt>Year</dt><dd>{vehicle.year}</dd></div>
            <div><dt>Make</dt><dd>{vehicle.make}</dd></div>
            <div><dt>Model</dt><dd>{vehicle.model}</dd></div>
            <div><dt>Trim</dt><dd>{vehicle.trim || "Not selected"}</dd></div>
            <div><dt>Engine</dt><dd>{vehicle.engine || "Not selected"}</dd></div>
            <div><dt>Drivetrain</dt><dd>{vehicle.drivetrain || "Not selected"}</dd></div>
            <div><dt>Fuel type</dt><dd>{formatFuelTypeLabel(vehicle.fuelType)}</dd></div>
          </dl>
        ) : null}
      </div>
      <div className="selected-vehicle-actions">
        <span className={`badge ${complete ? "" : "orange"}`}>{complete ? "Verified setup" : "Engine required"}</span>
        {vehicle.engine ? <FuelTypeBadge fuelType={vehicle.fuelType} /> : null}
        <Link className="secondary change-vehicle-link" to="/profile">Change Vehicle</Link>
      </div>
    </div>
  );
}
