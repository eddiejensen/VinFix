import { useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import type { DiagnosticCodeResult } from "../types";

export function CodeLookupPage() {
  const { selectedVehicle } = useVehicle();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DiagnosticCodeResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup() {
    if (!code.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try { setResult(await api.code(code.trim().toUpperCase(), selectedVehicle || undefined)); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  const fixes = result?.possibleFixes || result?.possible_fixes || [];
  return <div className="page narrow"><div className="page-head"><span className="eyebrow">Code lookup</span><h1>Explain a diagnostic trouble code</h1></div><div className="card"><label>Code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="P0300" /></label><button className="primary" onClick={lookup}>{loading ? "Looking up..." : "Look up code"}</button>{error && <div className="state error">{error}</div>}{result && <div className="result-card"><span className={`badge ${result.severity === "high" ? "red" : "orange"}`}>Severity, {result.severity || "unknown"}</span><h2>{result.code || code}</h2><p>{result.definition || result.description}</p>{fixes.length > 0 && <><h3>Possible fixes</h3><ul>{fixes.map((fix) => <li key={fix}>{fix}</li>)}</ul></>}{result.notes?.length ? <><h3>Notes</h3><ul>{result.notes.map((note) => <li key={note}>{note}</li>)}</ul></> : null}<p className="muted">These are possible causes, not guaranteed fixes.</p></div>}</div></div>;
}
