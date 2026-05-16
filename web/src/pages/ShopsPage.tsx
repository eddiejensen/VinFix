import { useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { PageTitle } from "../components/PageTitle";

export function ShopsPage() {
  const { selectedVehicle } = useVehicle();
  const [zip, setZip] = useState("");
  const [issue, setIssue] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function search() {
    const cleanZip = zip.trim();
    if (!/^\d{5}$/.test(cleanZip)) {
      setError("Enter a valid 5 digit ZIP code.");
      return;
    }
    try {
      setError("");
      setLoading(true);
      setShops(await api.shops(cleanZip, selectedVehicle || undefined, issue));
    } catch {
      setError("Shop search is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }
  return <div className="page narrow"><PageTitle title="Shops" /><div className="page-head"><span className="eyebrow">Shops</span><h1>Find nearby repair help</h1><p>Search local repair options by ZIP, vehicle, and issue.</p></div><SelectedVehicleCard vehicle={selectedVehicle} /><div className="card"><label>ZIP<input inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} /></label><label>Issue<input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="diagnostic, brakes, AC" /></label><button className="primary" disabled={loading} onClick={search}>{loading ? "Searching..." : "Find shops"}</button>{error && <div className="state error">{error}</div>}</div>{!loading && !error && shops.length === 0 && zip.length === 5 ? <div className="empty-card">No shops found near that ZIP yet. Try a nearby ZIP.</div> : null}<div className="stack">{shops.map((shop) => <article className="issue-card" key={shop.id}><h3>{shop.name}</h3><p>{[shop.distance, shop.specialty].filter(Boolean).join(", ")}</p><p>{shop.matchReason}</p>{shop.sourceUrl && <a href={shop.sourceUrl} target="_blank" rel="noreferrer">Open map source</a>}</article>)}</div></div>;
}
