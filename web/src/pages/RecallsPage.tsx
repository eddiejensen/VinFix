import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { PageTitle } from "../components/PageTitle";

export function RecallsPage() {
  const { selectedVehicle } = useVehicle();
  const [items, setItems] = useState<any[]>([]);
  const [mode, setMode] = useState<"recalls" | "tsbs">("recalls");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!selectedVehicle) return;
    setError("");
    (mode === "recalls" ? api.recalls(selectedVehicle) : api.tsbs(selectedVehicle))
      .then(setItems)
      .catch(() => {
        setItems([]);
        setError(`${mode === "recalls" ? "Recalls" : "TSBs"} are unavailable right now.`);
      });
  }, [selectedVehicle, mode]);
  return <div className="page"><PageTitle title="Recalls" /><div className="page-head"><span className="eyebrow">Safety</span><h1>Recalls</h1><p>Check safety campaigns and service resources for your selected vehicle.</p></div><SelectedVehicleCard vehicle={selectedVehicle} />{!selectedVehicle ? <div className="empty-card">Select a vehicle to load recalls.</div> : null}<div className="button-row"><button className={mode === "recalls" ? "primary" : "secondary"} onClick={() => setMode("recalls")}>Recalls</button><button className={mode === "tsbs" ? "primary" : "secondary"} onClick={() => setMode("tsbs")}>TSBs</button></div>{error ? <div className="state error">{error}</div> : null}<div className="stack">{items.map((item, idx) => <article className="issue-card" key={item.id || idx}><span className="badge">{mode}</span><h3>{item.component || item.title || item.campaignNumber || "Resource"}</h3><p>{item.summary || item.remedy || "No summary available"}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}</article>)}</div></div>;
}
