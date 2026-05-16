import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { PageTitle } from "../components/PageTitle";

export function PartsPage() {
  const { selectedVehicle } = useVehicle();
  const [parts, setParts] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!selectedVehicle) return;
    setError("");
    api.parts(selectedVehicle).then((data) => setParts(data.parts || [])).catch(() => {
      setParts([]);
      setError("Parts lookup is unavailable right now.");
    });
  }, [selectedVehicle]);
  return <div className="page"><PageTitle title="Parts" /><div className="page-head"><span className="eyebrow">Parts</span><h1>Fitment scoped part categories</h1><p>Find part categories and search hints for your selected vehicle.</p></div><SelectedVehicleCard vehicle={selectedVehicle} />{!selectedVehicle ? <div className="empty-card">Select a vehicle to load fitment scoped part categories.</div> : null}{error ? <div className="state error">{error}</div> : null}<div className="feature-grid">{parts.map((part) => <a className="feature-card" href={part.searchUrl} target="_blank" key={part.slug} rel="noreferrer"><span className="feature-icon">🔧</span><strong>{part.title}</strong><p>{part.searchHint}</p></a>)}</div></div>;
}
