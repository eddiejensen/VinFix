import { useEffect, useState } from "react";
import { PageTitle } from "../components/PageTitle";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { useVehicle } from "../context/VehicleContext";
import { makeId, readLocalArray, type RepairEntry, STORAGE_KEYS, vehicleKey, writeLocalArray } from "../utils/localData";

export function HistoryPage() {
  const { selectedVehicle } = useVehicle();
  const [entries, setEntries] = useState<RepairEntry[]>(() => readLocalArray(STORAGE_KEYS.repairHistory));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<RepairEntry["type"]>("repair");
  const [fixed, setFixed] = useState<RepairEntry["fixed"]>("unknown");
  const [partsCost, setPartsCost] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const activeKey = selectedVehicle ? vehicleKey(selectedVehicle) : "";

  useEffect(() => writeLocalArray(STORAGE_KEYS.repairHistory, entries), [entries]);

  function addEntry() {
    if (!selectedVehicle || !title.trim()) return;
    setEntries((prev) => [{
      id: makeId("history"),
      vehicleKey: activeKey,
      date: new Date().toISOString().slice(0, 10),
      type,
      title: title.trim(),
      notes,
      fixed,
      partsCost: Number(partsCost || 0),
      laborCost: Number(laborCost || 0),
    }, ...prev]);
    setTitle("");
    setNotes("");
    setPartsCost("");
    setLaborCost("");
  }

  const visibleEntries = entries.filter((entry) => !activeKey || entry.vehicleKey === activeKey);

  return <div className="page"><PageTitle title="History" /><div className="page-head"><span className="eyebrow">History</span><h1>Repair history and saved diagnostics</h1><p>Track repairs, maintenance, diagnostic notes, and cost history for your selected vehicle.</p><p>Your history is saved on this device for now. Account sync will be available later.</p></div><SelectedVehicleCard vehicle={selectedVehicle} />{!selectedVehicle ? <div className="empty-card">Select a vehicle to add history entries.</div> : <div className="card"><div className="form-grid"><label>Entry title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Replaced battery, diagnosed P0300" /></label><label>Type<select value={type} onChange={(e) => setType(e.target.value as RepairEntry["type"])}><option value="repair">Repair</option><option value="maintenance">Maintenance</option><option value="diagnostic">Diagnostic note</option></select></label><label>Parts cost<input inputMode="decimal" value={partsCost} onChange={(e) => setPartsCost(e.target.value)} placeholder="0.00" /></label><label>Labor cost<input inputMode="decimal" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0.00" /></label><label>Fixed issue?<select value={fixed} onChange={(e) => setFixed(e.target.value as RepairEntry["fixed"])}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label></div><label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened, what was checked, what changed?" /></label><button className="primary" disabled={!title.trim()} onClick={addEntry}>Save history entry</button></div>}<div className="stack">{visibleEntries.length === 0 ? <div className="empty-card">No history entries yet.</div> : null}{visibleEntries.map((entry) => <article className="issue-card" key={entry.id}><span className="badge">{entry.type}</span><h3>{entry.title}</h3><p>{entry.date}, fixed: {entry.fixed}</p><p>{entry.notes || "No notes saved."}</p><p className="muted">Cost: ${Number(entry.partsCost + entry.laborCost).toFixed(2)}</p><button className="secondary danger-soft" onClick={() => setEntries((prev) => prev.filter((item) => item.id !== entry.id))}>Delete</button></article>)}</div></div>;
}
