import { useEffect, useState } from "react";
import type { SelectedVehicle, VehicleImage } from "../types";
import { api } from "../api/client";
import { vehicleName } from "./SelectedVehicleCard";
import { isVehicleImageCompatible } from "../utils/vehicleImages";

export function VehicleImageCard({ vehicle }: { vehicle: SelectedVehicle | null }) {
  const [image, setImage] = useState<VehicleImage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!vehicle?.year || !vehicle.make || !vehicle.model) return;
      setLoading(true);
      try {
        const result = await api.image(vehicle);
        if (!cancelled) {
          const nextImage = result.image || null;
          setImage(nextImage && isVehicleImageCompatible(vehicle, nextImage) ? nextImage : null);
        }
      } catch {
        if (!cancelled) setImage(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]);

  if (!vehicle) return null;

  if (loading) return <div className="vehicle-image placeholder">Loading vehicle image...</div>;
  if (!image?.thumbnailUrl && !image?.imageUrl) return <div className="vehicle-image placeholder">Vehicle image not available yet</div>;

  return (
    <figure className="vehicle-image-card">
      <img src={image.thumbnailUrl || image.imageUrl} alt={vehicleName(vehicle)} />
      <figcaption>Representative image, source {image.source || "Wikimedia"}</figcaption>
    </figure>
  );
}
