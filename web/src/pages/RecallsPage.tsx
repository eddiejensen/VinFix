import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";

export function RecallsPage() {
  const { selectedVehicle } = useVehicle();
  const [items, setItems] = useState<any[]>([]);
  const [mode, setMode] = useState<"recalls" | "tsbs">("recalls");
  useEffect(() => { if (!selectedVehicle) return; (mode === "recalls" ? api.recalls(selectedVehicle) : api.tsbs(selectedVehicle)).then(setItems).catch(() => setItems([])); }, [selectedVehicle, mode]);
  return <div className="page"><div className="page-head"><span className="eyebrow">Safety and service</span><h1>Recalls and TSB resources</h1></div><SelectedVehicleCard vehicle={selectedVehicle} /><div className="button-row"><button className={mode === "recalls" ? "primary" : "secondary"} onClick={() => setMode("recalls")}>Recalls</button><button className={mode === "tsbs" ? "primary" : "secondary"} onClick={() => setMode("tsbs")}>TSBs</button></div><div className="stack">{items.map((item, idx) => <article className="issue-card" key={item.id || idx}><span className="badge">{mode}</span><h3>{item.component || item.title || item.campaignNumber || "Resource"}</h3><p>{item.summary || item.remedy || "No summary available"}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank">Open source</a>}</article>)}</div></div>;
}
