import { PageTitle } from "../components/PageTitle";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { useVehicle } from "../context/VehicleContext";
import { readLocalArray, type RepairEntry, STORAGE_KEYS, vehicleKey } from "../utils/localData";

export function CostsPage() {
  const { selectedVehicle } = useVehicle();
  const entries = readLocalArray<RepairEntry>(STORAGE_KEYS.repairHistory);
  const activeKey = selectedVehicle ? vehicleKey(selectedVehicle) : "";
  const vehicleEntries = entries.filter((entry) => !activeKey || entry.vehicleKey === activeKey);
  const parts = vehicleEntries.reduce((sum, entry) => sum + Number(entry.partsCost || 0), 0);
  const labor = vehicleEntries.reduce((sum, entry) => sum + Number(entry.laborCost || 0), 0);

  return <div className="page"><PageTitle title="Costs" /><div className="page-head"><span className="eyebrow">Costs</span><h1>Repair cost summary</h1><p>Track total parts, labor, and repair spend from local history entries.</p></div><SelectedVehicleCard vehicle={selectedVehicle} /><div className="feature-grid"><div className="result-card"><span className="eyebrow">Parts</span><h2>${parts.toFixed(2)}</h2></div><div className="result-card"><span className="eyebrow">Labor</span><h2>${labor.toFixed(2)}</h2></div><div className="result-card"><span className="eyebrow">Total spent</span><h2>${(parts + labor).toFixed(2)}</h2></div></div>{vehicleEntries.length === 0 ? <div className="empty-card">Add repair history entries with costs to build this summary.</div> : null}</div>;
}
