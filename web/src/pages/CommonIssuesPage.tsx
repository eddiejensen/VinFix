import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useVehicle } from "../context/VehicleContext";
import type { CommonIssue } from "../types";
import { CommonIssueCards } from "../components/CommonIssueCards";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";

export function CommonIssuesPage() {
  const { selectedVehicle } = useVehicle();
  const [issues, setIssues] = useState<CommonIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedVehicle) return;
    setLoading(true); setError("");
    api.commonIssues(selectedVehicle).then(setIssues).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [selectedVehicle?.year, selectedVehicle?.make, selectedVehicle?.model]);

  return <div className="page"><div className="page-head"><span className="eyebrow">Common issues</span><h1>Known complaint patterns</h1><p>Uses GET /common-issues/:make/:model/:year from the backend.</p></div><SelectedVehicleCard vehicle={selectedVehicle} />{!selectedVehicle && <div className="empty-card">Select a vehicle first to load common issue patterns.</div>}{loading && <div className="state loading">Checking common issues...</div>}{error && <div className="state error">Common issues are unavailable right now. {error}</div>}{selectedVehicle ? <CommonIssueCards issues={issues} /> : null}</div>;
}
