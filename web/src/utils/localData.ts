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
  garage: "vinfix:garage",
  repairHistory: "vinfix:repairHistory",
  todos: "vinfix:todos",
  diagnosticNotes: "vinfix:diagnosticNotes",
};

export function vehicleKey(vehicle: Pick<SelectedVehicle, "year" | "make" | "model" | "trim" | "engine">) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.engine]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

export function readLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeLocalArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
