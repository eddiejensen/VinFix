import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SelectedVehicle } from "../types";
import { normalizeEngineOption } from "../utils/engineOptions";
import { normalizeFuelType } from "../utils/fuelType";

interface VehicleContextValue {
  selectedVehicle: SelectedVehicle | null;
  setSelectedVehicle: (vehicle: SelectedVehicle | null) => void;
}

const VehicleContext = createContext<VehicleContextValue | null>(null);
const STORAGE_KEY = "vinfix:selectedVehicle";
const LEGACY_STORAGE_KEY = "vinfix_selected_vehicle_v1";

function normalizeVehicleFromUnknown(value: any): SelectedVehicle | null {
  if (!value?.year || !value?.make || !value?.model) return null;
  const engine = normalizeEngineOption(value.engine || "", value);
  return {
    year: String(value.year || ""),
    make: String(value.make || ""),
    model: String(value.model || ""),
    trim: value.trim || "",
    engine: value.engine || engine.label || "",
    drivetrain: value.drivetrain || "",
    transmission: value.transmission || "",
    fuelType: normalizeFuelType(value.fuelType || engine.fuelType),
    fuelTypeConfidence: value.fuelTypeConfidence || engine.confidence || "low",
    vin: value.vin || "",
    image: value.image || null,
    id: value.id || undefined,
  };
}

function vehicleFromUrl(): SelectedVehicle | null {
  const params = new URLSearchParams(window.location.search);
  const encodedVehicle = params.get("vehicle");

  if (encodedVehicle) {
    try {
      return normalizeVehicleFromUnknown(JSON.parse(atob(encodedVehicle)));
    } catch {
      return null;
    }
  }

  if (!params.get("year") || !params.get("make") || !params.get("model")) {
    return null;
  }

  return normalizeVehicleFromUnknown({
    year: params.get("year"),
    make: params.get("make"),
    model: params.get("model"),
    trim: params.get("trim") || "",
    engine: params.get("engine") || "",
    drivetrain: params.get("drivetrain") || "",
    transmission: params.get("transmission") || "",
    fuelType: params.get("fuelType") || "",
  });
}

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const [selectedVehicle, setSelectedVehicleState] = useState<SelectedVehicle | null>(() => {
    try {
      const urlVehicle = vehicleFromUrl();
      if (urlVehicle) return urlVehicle;
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      return raw ? normalizeVehicleFromUnknown(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });

  const setSelectedVehicle = (vehicle: SelectedVehicle | null) => setSelectedVehicleState(vehicle);

  useEffect(() => {
    if (selectedVehicle) localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedVehicle));
    else localStorage.removeItem(STORAGE_KEY);
  }, [selectedVehicle]);

  const value = useMemo(() => ({ selectedVehicle, setSelectedVehicle }), [selectedVehicle]);
  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicle() {
  const value = useContext(VehicleContext);
  if (!value) throw new Error("useVehicle must be used inside VehicleProvider");
  return value;
}
