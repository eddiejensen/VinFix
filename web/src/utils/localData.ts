import type { SelectedVehicle } from "../types";

export interface RepairEntry {
  id: string;
  vehicleKey: string;
  date: string;
  type: "repair" | "maintenance" | "diagnostic";
  title: string;
  notes: string;
  partsCost: number;
  laborCost: number;
  fixed: "yes" | "no" | "unknown";
}

export interface TodoEntry {
  id: string;
  vehicleKey: string;
  title: string;
  notes: string;
  complete: boolean;
}

export const STORAGE_KEYS = {
  garage: "autovinfix:garage",
  repairHistory: "autovinfix:repairHistory",
  todos: "autovinfix:todos",
  diagnosticNotes: "autovinfix:diagnosticNotes",
};

export const LOCAL_DATA_SYNC_EVENT = "autovinfix:local-data-sync";
export const CLOUD_DATA_RESTORE_EVENT = "autovinfix:cloud-data-restore";

const LEGACY_PREFIX = "vinfix:";

export function vehicleKey(vehicle: Pick<SelectedVehicle, "year" | "make" | "model" | "trim" | "engine">) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.engine]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

export function readLocalArray<T>(key: string): T[] {
  try {
    const legacyKey = key.startsWith("autovinfix:") ? key.replace("autovinfix:", LEGACY_PREFIX) : "";
    const raw = localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : null);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeLocalArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(LOCAL_DATA_SYNC_EVENT));
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
