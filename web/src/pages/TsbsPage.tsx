import { useEffect, useState } from "react";
import { api } from "../api/client";
import { PageTitle } from "../components/PageTitle";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { useVehicle } from "../context/VehicleContext";

export function TsbsPage() {
  const { selectedVehicle } = useVehicle();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedVehicle) return;
    setLoading(true);
    setError("");
    api.tsbs(selectedVehicle)
      .then(setItems)
      .catch(() => {
        setItems([]);
        setError("Technical service bulletins are temporarily unavailable.");
      })
      .finally(() => setLoading(false));
  }, [selectedVehicle]);

  return (
    <div className="page">
      <PageTitle title="TSBs" />
      <div className="page-head">
        <span className="eyebrow">Service bulletins</span>
        <h1>Technical service bulletins</h1>
        <p>Review known service patterns for your selected vehicle.</p>
      </div>
      <SelectedVehicleCard vehicle={selectedVehicle} />
      {!selectedVehicle ? <div className="empty-card">Select a vehicle to load service bulletins.</div> : null}
      {loading ? <div className="state loading">Loading service bulletins...</div> : null}
      {error ? <div className="state error">{error}</div> : null}
      <div className="stack">
        {items.map((item, idx) => (
          <article className="issue-card" key={item.id || idx}>
            <span className="badge">TSB</span>
            <h3>{item.component || item.title || "Service bulletin"}</h3>
            <p>{item.summary || item.remedy || "No summary available."}</p>
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}
          </article>
        ))}
      </div>
    </div>
  );
}
