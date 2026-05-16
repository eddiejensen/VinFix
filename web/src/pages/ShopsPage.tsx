import { useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";

export function ShopsPage() {
  const { selectedVehicle } = useVehicle();
  const [zip, setZip] = useState("");
  const [issue, setIssue] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  const [error, setError] = useState("");
  async function search() {
    if (!zip.trim()) {
      setError("Enter a ZIP code first.");
      return;
    }
    try {
      setError("");
      setShops(await api.shops(zip, selectedVehicle || undefined, issue));
    } catch {
      setError("Shop search is unavailable right now.");
    }
  }
  return <div className="page narrow"><div className="page-head"><span className="eyebrow">Shops</span><h1>Find nearby repair help</h1><p>Uses GET /shops with ZIP, make, and issue filters.</p></div><SelectedVehicleCard vehicle={selectedVehicle} /><div className="card"><label>ZIP<input value={zip} onChange={(e) => setZip(e.target.value)} /></label><label>Issue<input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="diagnostic, brakes, AC" /></label><button className="primary" onClick={search}>Find shops</button>{error && <div className="state error">{error}</div>}</div><div className="stack">{shops.map((shop) => <article className="issue-card" key={shop.id}><h3>{shop.name}</h3><p>{shop.distance}, {shop.specialty}</p><p>{shop.matchReason}</p>{shop.sourceUrl && <a href={shop.sourceUrl} target="_blank" rel="noreferrer">Open map source</a>}</article>)}</div></div>;
}
