import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";

export function PartsPage() {
  const { selectedVehicle } = useVehicle();
  const [parts, setParts] = useState<any[]>([]);
  useEffect(() => { if (selectedVehicle) api.parts(selectedVehicle).then((data) => setParts(data.parts || [])).catch(() => setParts([])); }, [selectedVehicle]);
  return <div className="page"><div className="page-head"><span className="eyebrow">Parts</span><h1>Fitment scoped part categories</h1></div><SelectedVehicleCard vehicle={selectedVehicle} /><div className="feature-grid">{parts.map((part) => <a className="feature-card" href={part.searchUrl} target="_blank" key={part.slug}><span className="feature-icon">🔧</span><strong>{part.title}</strong><p>{part.searchHint}</p></a>)}</div></div>;
}
