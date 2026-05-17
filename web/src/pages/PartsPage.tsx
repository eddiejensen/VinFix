import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { PageTitle } from "../components/PageTitle";
import { buildRockAutoCatalogUrl, getRockAutoVehicleMapping } from "../utils/rockAuto";

export function PartsPage() {
  const { selectedVehicle } = useVehicle();
  const [parts, setParts] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!selectedVehicle) {
      setParts([]);
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    api.parts(selectedVehicle)
      .then((data) => setParts(data.parts || []))
      .catch(() => {
        setParts([]);
        setError("Parts lookup is unavailable right now.");
      })
      .finally(() => setLoading(false));
  }, [selectedVehicle]);

  const hasRockAutoMapping = Boolean(getRockAutoVehicleMapping(selectedVehicle));

  return <div className="page"><PageTitle title="Parts" /><div className="page-head"><span className="eyebrow">Parts</span><h1>Fitment scoped part categories</h1><p>Find part categories and search hints for your selected vehicle.</p></div><SelectedVehicleCard vehicle={selectedVehicle} />{!selectedVehicle ? <div className="empty-card">Select a vehicle to load fitment scoped part categories.</div> : null}{selectedVehicle && !hasRockAutoMapping ? <div className="state warning">Direct RockAuto catalog links need a verified vehicle code for this exact year, make, model, and engine. Select a mapped vehicle or use the search hints below.</div> : null}{loading ? <div className="state loading">Loading part categories...</div> : null}{error ? <div className="state error">{error}</div> : null}<div className="feature-grid">{parts.map((part) => {
    const rockAutoUrl = buildRockAutoCatalogUrl(selectedVehicle, part.title);
    const content = <><span className="feature-icon">🔧</span><strong>{part.title}</strong><p>{part.searchHint}</p>{rockAutoUrl ? <span className="badge orange">Open RockAuto catalog</span> : <span className="badge">Vehicle code needed</span>}</>;
    return rockAutoUrl ? (
      <a className="feature-card" href={rockAutoUrl} target="_blank" key={part.slug} rel="noreferrer">{content}</a>
    ) : (
      <article className="feature-card" key={part.slug}>{content}</article>
    );
  })}</div></div>;
}
