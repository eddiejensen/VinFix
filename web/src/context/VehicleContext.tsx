import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SelectedVehicle } from "../types";

interface VehicleContextValue {
  selectedVehicle: SelectedVehicle | null;
  setSelectedVehicle: (vehicle: SelectedVehicle | null) => void;
}

const VehicleContext = createContext<VehicleContextValue | null>(null);
const STORAGE_KEY = "vinfix_selected_vehicle_v1";

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const [selectedVehicle, setSelectedVehicleState] = useState<SelectedVehicle | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
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
