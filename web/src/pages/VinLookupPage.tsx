import { useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { normalizeEngineOption } from "../utils/engineOptions";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import type { SelectedVehicle } from "../types";

export function VinLookupPage() {
  const { selectedVehicle, setSelectedVehicle } = useVehicle();
  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function decode() {
    setLoading(true); setError("");
    try {
      const result = await api.vin(vin.trim().toUpperCase());
      const engine = normalizeEngineOption(result.engine || "", result);
      const vehicle: SelectedVehicle = { year: result.year || "", make: result.make || "", model: result.model || "", trim: result.trim || "", drivetrain: result.drivetrain || "", engine: result.engine || engine.label, fuelType: result.fuelType || engine.fuelType, fuelTypeConfidence: result.fuelTypeConfidence || engine.confidence, vin };
      setSelectedVehicle(vehicle);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return <div className="page narrow"><div className="page-head"><span className="eyebrow">VIN</span><h1>Decode a VIN</h1></div><div className="card"><label>VIN<input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17 digit VIN" /></label><button className="primary" onClick={decode}>{loading ? "Decoding..." : "Decode VIN"}</button>{error && <div className="state error">{error}</div>}<SelectedVehicleCard vehicle={selectedVehicle} /></div></div>;
}
