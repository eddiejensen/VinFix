import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { EngineOption, SelectedVehicle } from "../types";
import { normalizeEngineOption, formatEngineOptionLabel } from "../utils/engineOptions";
import { useVehicle } from "../context/VehicleContext";
import { ErrorState } from "./ErrorState";

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
  const [drivetrain, setDrivetrain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.years().then(setYears).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!year) return;
    setMake(""); setModel(""); setTrim(""); setEngineValue(""); setModels([]); setTrims([]); setEngines([]); setDrivetrains([]);
    setLoading(true);
    api.makes(year).then(setMakes).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    if (!year || !make) return;
    setModel(""); setTrim(""); setEngineValue(""); setModels([]); setTrims([]); setEngines([]); setDrivetrains([]);
    setLoading(true);
    api.models(year, make).then(setModels).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [year, make]);

  useEffect(() => {
    if (!year || !make || !model) return;
    setLoading(true);
    Promise.allSettled([api.trims(year, make, model), api.fitment({ year, make, model, trim })])
      .then(([trimsResult, fitmentResult]) => {
        if (trimsResult.status === "fulfilled") setTrims(trimsResult.value || []);
        if (fitmentResult.status === "fulfilled") {
          const fit = fitmentResult.value;
          const context = { year, make, model, trim };
          setEngines((fit.engines || []).map((item) => normalizeEngineOption(item, context)).filter((item) => item.label));
          setDrivetrains(fit.drivetrains || []);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year, make, model, trim]);

  const selectedEngine = useMemo(() => engines.find((e) => e.value === engineValue) || null, [engines, engineValue]);
  const canUse = Boolean(year && make && model);

  function save() {
    const fallback = normalizeEngineOption(engineValue || "Unknown engine", { year, make, model, trim });
    const engine = selectedEngine || fallback;
    const vehicle: SelectedVehicle = {
      year, make, model, trim, drivetrain,
      engine: engine.label,
      fuelType: engine.fuelType,
      fuelTypeConfidence: engine.confidence,
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
        <label>Engine<select value={engineValue} onChange={(e) => setEngineValue(e.target.value)} disabled={!model || engines.length === 0}><option value="">{engines.length ? "Select engine" : "Engine optional"}</option>{engines.map((v) => <option key={v.value} value={v.value}>{formatEngineOptionLabel(v)}</option>)}</select></label>
        <label>Drivetrain<select value={drivetrain} onChange={(e) => setDrivetrain(e.target.value)} disabled={!model || drivetrains.length === 0}><option value="">Optional drivetrain</option>{drivetrains.map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      <button className="primary" disabled={!canUse} onClick={save}>{loading ? "Loading..." : "Use this vehicle"}</button>
    </div>
  );
}
