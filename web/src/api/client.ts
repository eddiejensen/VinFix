import type { CommonIssue, DiagnosticCodeResult, SelectedVehicle, VehicleImage } from "../types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://autofixhelp-api.onrender.com";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}${path}`, init);
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || `Request failed, ${response.status}`);
  }

  return json as T;
}

export const api = {
  years: () => request<string[]>("/years?source=fallback"),
  makes: (year: string) => request<string[]>(`/makes?year=${encodeURIComponent(year)}`),
  models: (year: string, make: string) =>
    request<string[]>(`/models?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`),
  trims: (year: string, make: string, model: string) =>
    request<string[]>(
      `/trims?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
    ),
  fitment: (vehicle: Pick<SelectedVehicle, "year" | "make" | "model" | "trim">) => {
    const params = new URLSearchParams({ year: vehicle.year, make: vehicle.make, model: vehicle.model });
    if (vehicle.trim) params.set("trim", vehicle.trim);
    return request<{ trims: string[]; engines: unknown[]; drivetrains: string[]; transmissions?: string[] }>(
      `/engine-drivetrain-options?${params.toString()}`
    );
  },
  vin: (vin: string) => request<any>(`/vin/${encodeURIComponent(vin)}`),
  code: (code: string, vehicle?: Partial<SelectedVehicle>) => {
    const params = new URLSearchParams();
    if (vehicle?.year) params.set("year", vehicle.year);
    if (vehicle?.make) params.set("make", vehicle.make);
    if (vehicle?.model) params.set("model", vehicle.model);
    if (vehicle?.engine) params.set("engine", vehicle.engine);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<DiagnosticCodeResult>(`/diagnostic/${encodeURIComponent(code)}${suffix}`);
  },
  commonIssues: (vehicle: SelectedVehicle) =>
    request<CommonIssue[]>(
      `/common-issues/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}`
    ),
  recalls: (vehicle: SelectedVehicle) =>
    request<any[]>(
      `/recalls/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}`
    ),
  tsbs: (vehicle: SelectedVehicle) =>
    request<any[]>(
      `/tsbs/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}`
    ),
  parts: (vehicle: SelectedVehicle) => {
    const params = new URLSearchParams();
    if (vehicle.engine) params.set("engine", vehicle.engine);
    if (vehicle.drivetrain) params.set("drivetrain", vehicle.drivetrain);
    return request<any>(
      `/parts/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}?${params.toString()}`
    );
  },
  shops: (zip: string, vehicle?: SelectedVehicle, issue?: string) => {
    const params = new URLSearchParams({ zip });
    if (vehicle?.make) params.set("make", vehicle.make);
    if (issue) params.set("issue", issue);
    return request<any[]>(`/shops?${params.toString()}`);
  },
  image: (vehicle: Pick<SelectedVehicle, "year" | "make" | "model" | "trim">) => {
    const params = new URLSearchParams({ year: vehicle.year, make: vehicle.make, model: vehicle.model });
    if (vehicle.trim) params.set("trim", vehicle.trim);
    return request<{ success: boolean; image: VehicleImage | null }>(`/vehicle-image?${params.toString()}`);
  },
};
