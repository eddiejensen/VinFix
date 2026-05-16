export type FuelType =
  | "gasoline"
  | "diesel"
  | "hybrid"
  | "plug_in_hybrid"
  | "electric"
  | "flex_fuel"
  | "unknown";

export type Confidence = "high" | "medium" | "low";

export interface EngineOption {
  label: string;
  value: string;
  engineCode?: string;
  fuelType: FuelType;
  confidence: Confidence;
  source?: string;
}

export interface SelectedVehicle {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  drivetrain?: string;
  transmission?: string;
  fuelType: FuelType;
  fuelTypeConfidence: Confidence;
  vin?: string;
  image?: VehicleImage | null;
  id?: string;
}

export interface VehicleImage {
  title?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  source?: string;
  license?: string;
  author?: string;
  attributionUrl?: string;
  confidence?: string;
  matchType?: string;
}

export interface CommonIssue {
  id?: string;
  title?: string;
  issue?: string;
  component?: string;
  summary?: string;
  supportingDetail?: string;
  symptomTrigger?: string;
  commonFix?: string;
  complaintCount?: number;
  sourceName?: string;
  sourceUrl?: string;
}

export interface DiagnosticCodeResult {
  code?: string;
  definition?: string;
  description?: string;
  severity?: string;
  possibleFixes?: string[];
  possible_fixes?: string[];
  notes?: string[];
  sourceName?: string;
  source_name?: string;
}
