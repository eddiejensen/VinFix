import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { EngineOption, SelectedVehicle } from "../types";
import { normalizeEngineOption, formatEngineOptionLabel } from "../utils/engineOptions";
import { useVehicle } from "../context/VehicleContext";
import { ErrorState } from "./ErrorState";
import type { FuelType } from "../types";
import { formatFuelTypeLabel, normalizeFuelType } from "../utils/fuelType";

export function VehicleSelector() {
  const { setSelectedVehicle } = useVehicle();
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<string[]>([]);
  const [engines, setEngines] = useState<EngineOption[]>([]);
  const [drivetrains, setDrivetrains] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [engineValue, setEngineValue] = useState("");
  const [manualEngine, setManualEngine] = useState("");
  const [manualFuelType, setManualFuelType] = useState<FuelType>("unknown");
  const [drivetrain, setDrivetrain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.years().then(setYears).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!year) return;
    setMake(""); setModel(""); setTrim(""); setEngineValue(""); setManualEngine(""); setModels([]); setTrims([]); setEngines([]); setDrivetrains([]);
    setLoading(true);
    api.makes(year).then(setMakes).catch(() => setError("Could not load makes. Please try again.")).finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    if (!year || !make) return;
    setModel(""); setTrim(""); setEngineValue(""); setManualEngine(""); setModels([]); setTrims([]); setEngines([]); setDrivetrains([]);
    setLoading(true);
    api.models(year, make).then(setModels).catch(() => setError("Could not load models. Please try again.")).finally(() => setLoading(false));
  }, [year, make]);

  useEffect(() => {
    if (!year || !make || !model) return;
    setLoading(true);
    Promise.allSettled([api.trims(year, make, model), api.fitment({ year, make, model, trim })])
      .then(([trimsResult, fitmentResult]) => {
        if (trimsResult.status === "fulfilled") setTrims(Array.from(new Set(trimsResult.value || [])));
        if (fitmentResult.status === "fulfilled") {
          const fit = fitmentResult.value;
          const context = { year, make, model, trim };
          setEngines((fit.engines || []).map((item) => normalizeEngineOption(item, context)).filter((item) => item.label));
          setDrivetrains(Array.from(new Set(fit.drivetrains || [])));
        } else {
          setError("Engine data was not available. You can still continue with manual details.");
        }
      })
      .catch(() => setError("Could not load trim and engine data. You can still continue manually."))
      .finally(() => setLoading(false));
  }, [year, make, model, trim]);

  const selectedEngine = useMemo(() => engines.find((e) => e.value === engineValue) || null, [engines, engineValue]);
  const needsManualFuelType =
    engines.length === 0 ||
    Boolean(
      selectedEngine &&
        (selectedEngine.fuelType === "unknown" || selectedEngine.confidence === "low")
    );
  const canUse = Boolean(year && make && model && (engines.length === 0 || engineValue));

  function save() {
    const fallback = normalizeEngineOption(manualEngine || engineValue || "Unknown engine", { year, make, model, trim });
    const engine = selectedEngine || fallback;
    const fuelType = needsManualFuelType ? normalizeFuelType(manualFuelType) : engine.fuelType;
    const vehicle: SelectedVehicle = {
      year, make, model, trim, drivetrain,
      engine: engine.label === "Unknown engine" ? manualEngine : engine.label,
      fuelType,
      fuelTypeConfidence: needsManualFuelType ? "low" : engine.confidence,
    };
    setSelectedVehicle(vehicle);
  }

  return (
    <div className="card vehicle-selector">
      <div className="section-title"><span className="eyebrow">Start here</span><h2>Select your vehicle</h2></div>
      {error && <ErrorState message={error} />}
      <div className="form-grid">
        <label>Year<select value={year} onChange={(e) => setYear(e.target.value)}><option value="">Select year</option>{years.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Make<select value={make} onChange={(e) => setMake(e.target.value)} disabled={!year}><option value="">Select make</option>{makes.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Model<select value={model} onChange={(e) => setModel(e.target.value)} disabled={!make}><option value="">Select model</option>{models.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Trim<select value={trim} onChange={(e) => setTrim(e.target.value)} disabled={!model || trims.length === 0}><option value="">Optional trim</option>{trims.map((v) => <option key={v}>{v}</option>)}</select></label>
        {engines.length > 0 ? (
          <label>Engine<select value={engineValue} onChange={(e) => setEngineValue(e.target.value)} disabled={!model}><option value="">Select engine</option>{engines.map((v) => <option key={v.value} value={v.value}>{formatEngineOptionLabel(v)}</option>)}</select></label>
        ) : (
          <label>Engine<input value={manualEngine} onChange={(e) => setManualEngine(e.target.value)} placeholder="Optional engine, if known" disabled={!model} /></label>
        )}
        <label>Drivetrain<select value={drivetrain} onChange={(e) => setDrivetrain(e.target.value)} disabled={!model || drivetrains.length === 0}><option value="">Optional drivetrain</option>{drivetrains.map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      {canUse && needsManualFuelType ? (
        <div className="fuel-fallback">
          <strong>Fuel type</strong>
          <p>Engine data did not include a confident fuel type. Pick one to keep diagnosis filtered correctly.</p>
          <div className="chip-row">
            {(["gasoline", "diesel", "hybrid", "plug_in_hybrid", "electric", "flex_fuel", "unknown"] as FuelType[]).map((fuelType) => (
              <button
                className={manualFuelType === fuelType ? "chip active" : "chip"}
                key={fuelType}
                onClick={() => setManualFuelType(fuelType)}
                type="button"
              >
                {formatFuelTypeLabel(fuelType)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button className="primary" disabled={!canUse} onClick={save}>{loading ? "Loading..." : "Use this vehicle"}</button>
    </div>
  );
}
