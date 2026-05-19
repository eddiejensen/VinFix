import type { CommonIssue, DiagnosticCodeResult, SelectedVehicle, VehicleImage } from "../types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://autofixhelp-api.onrender.com";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}${path}`, init);
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(json?.error || `Request failed, ${response.status}`);
    }

    return json as T;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("AutoVinFix API request failed", { path, error });
    }
    throw error;
  }
}

function authHeaders(sessionToken?: string): HeadersInit {
  return sessionToken ? { "x-session-token": sessionToken } : {};
}

export function getYears() {
  return request<string[]>("/years");
}

export function getMakes(year: string) {
  return request<string[]>(`/makes?year=${encodeURIComponent(year)}`);
}

const MODEL_CLEANUP: Record<string, string[]> = {
  "toyota:2020": ["celica", "paseo"],
};

export async function getModels(year: string, make: string) {
  const models = await request<string[]>(
    `/models?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`
  );
  const blocked = MODEL_CLEANUP[`${make.toLowerCase()}:${year}`] || [];
  return models.filter((model) => !blocked.includes(model.toLowerCase()));
}

export function getTrims(year: string, make: string, model: string) {
  return request<string[]>(
    `/trims?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
  );
}

export function getEngineDrivetrainOptions(year: string, make: string, model: string, trim = "", drivetrain = "") {
  const params = new URLSearchParams({ year, make, model });
  if (trim) params.set("trim", trim);
  if (drivetrain) params.set("drivetrain", drivetrain);
  return request<{ trims: string[]; engines: unknown[]; drivetrains: string[]; transmissions?: string[] }>(
    `/engine-drivetrain-options?${params.toString()}`
  );
}

export function decodeVin(vin: string) {
  return request<any>(`/vin/${encodeURIComponent(vin)}`);
}

export function lookupDiagnosticCode(code: string, vehicle?: Partial<SelectedVehicle>) {
  const params = new URLSearchParams();
  if (vehicle?.year) params.set("year", vehicle.year);
  if (vehicle?.make) params.set("make", vehicle.make);
  if (vehicle?.model) params.set("model", vehicle.model);
  if (vehicle?.trim) params.set("trim", vehicle.trim);
  if (vehicle?.engine) params.set("engine", vehicle.engine);
  if (vehicle?.drivetrain) params.set("drivetrain", vehicle.drivetrain);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<DiagnosticCodeResult>(`/diagnostic/${encodeURIComponent(code)}${suffix}`);
}

export function getCommonIssues(vehicle: SelectedVehicle) {
  return request<CommonIssue[]>(
    `/common-issues/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}`
  );
}

export function getRecalls(vehicle: SelectedVehicle) {
  return request<any[]>(
    `/recalls/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}`
  );
}

export function getTsbs(vehicle: SelectedVehicle) {
  return request<any[]>(
    `/tsbs/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}`
  );
}

export function getParts(vehicle: SelectedVehicle) {
  const params = new URLSearchParams();
  if (vehicle.engine) params.set("engine", vehicle.engine);
  if (vehicle.drivetrain) params.set("drivetrain", vehicle.drivetrain);
  return request<any>(
    `/parts/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/${encodeURIComponent(vehicle.year)}?${params.toString()}`
  );
}

export function getShops({ zip, make, issue }: { zip: string; make?: string; issue?: string }) {
  const params = new URLSearchParams({ zip });
  if (make) params.set("make", make);
  if (issue) params.set("issue", issue);
  return request<any[]>(`/shops?${params.toString()}`);
}

export function getVehicleImage(vehicle: Pick<SelectedVehicle, "year" | "make" | "model" | "trim">) {
  const params = new URLSearchParams({ year: vehicle.year, make: vehicle.make, model: vehicle.model });
  if (vehicle.trim) params.set("trim", vehicle.trim);
  return request<{ success: boolean; image: VehicleImage | null }>(`/vehicle-image?${params.toString()}`);
}

export interface AuthUser {
  id: number;
  email: string;
  fullName?: string;
  plan?: string;
}

export interface AuthResponse {
  mode: "authenticated" | "guest";
  sessionToken: string;
  user: AuthUser | null;
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function getSession(sessionToken: string) {
  return request<AuthResponse>("/auth/session", {
    headers: authHeaders(sessionToken),
  });
}

export function logout(sessionToken: string) {
  return request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    headers: authHeaders(sessionToken),
  });
}

export function getAccountData(sessionToken: string) {
  return request<{ data: Record<string, unknown>; updatedAt: string | null }>("/account/data", {
    headers: authHeaders(sessionToken),
  });
}

export function saveAccountData(sessionToken: string, data: Record<string, unknown>) {
  return request<{ data: Record<string, unknown>; updatedAt: string | null }>("/account/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
    body: JSON.stringify({ data }),
  });
}

export function trackEvent(body: { sessionId: string; eventName: string; payload?: Record<string, unknown> }) {
  return request<{ ok: boolean }>("/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  years: getYears,
  makes: getMakes,
  models: getModels,
  trims: getTrims,
  fitment: (vehicle: Pick<SelectedVehicle, "year" | "make" | "model" | "trim" | "drivetrain">) =>
    getEngineDrivetrainOptions(vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.drivetrain),
  vin: decodeVin,
  code: lookupDiagnosticCode,
  commonIssues: getCommonIssues,
  recalls: getRecalls,
  tsbs: getTsbs,
  parts: getParts,
  shops: (zip: string, vehicle?: SelectedVehicle, issue?: string) =>
    getShops({ zip, make: vehicle?.make, issue }),
  image: getVehicleImage,
  login,
  getSession,
  logout,
  getAccountData,
  saveAccountData,
  trackEvent,
};
