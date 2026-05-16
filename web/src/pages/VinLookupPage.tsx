import { useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { normalizeEngineOption } from "../utils/engineOptions";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import type { SelectedVehicle } from "../types";
import { PageTitle } from "../components/PageTitle";

export function VinLookupPage() {
  const { selectedVehicle, setSelectedVehicle } = useVehicle();
  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function decode() {
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin.trim())) {
      setError("Enter a valid 17 character VIN.");
      return;
    }
    setLoading(true); setError("");
    try {
      const result = await api.vin(vin.trim().toUpperCase());
      const engine = normalizeEngineOption(result.engine || "", result);
      const vehicle: SelectedVehicle = { year: result.year || "", make: result.make || "", model: result.model || "", trim: result.trim || "", drivetrain: result.drivetrain || "", engine: result.engine || engine.label, fuelType: result.fuelType || engine.fuelType, fuelTypeConfidence: result.fuelTypeConfidence || engine.confidence, vin };
      setSelectedVehicle(vehicle);
    } catch { setError("VIN lookup is temporarily unavailable. Try again in a moment."); }
    finally { setLoading(false); }
  }

  return <div className="page narrow"><PageTitle title="VIN Lookup" /><div className="page-head"><span className="eyebrow">VIN</span><h1>Decode a VIN</h1><p>Use a VIN to identify your vehicle and personalize diagnostics.</p></div><div className="card"><label>VIN<input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="17 digit VIN" /></label><button className="primary" disabled={loading} onClick={decode}>{loading ? "Decoding..." : "Decode VIN"}</button>{error && <div className="state error">{error}</div>}<SelectedVehicleCard vehicle={selectedVehicle} /></div></div>;
}
