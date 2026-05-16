import { useState } from "react";
import { PageTitle } from "../components/PageTitle";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { useVehicle } from "../context/VehicleContext";
import { makeId, readLocalArray, type RepairEntry, STORAGE_KEYS, vehicleKey, writeLocalArray } from "../utils/localData";

export function PartIdentifierPage() {
  const { selectedVehicle } = useVehicle();
  const [preview, setPreview] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  function saveNote() {
    if (!selectedVehicle) return;
    const entries = readLocalArray<RepairEntry>(STORAGE_KEYS.diagnosticNotes);
    writeLocalArray(STORAGE_KEYS.diagnosticNotes, [{
      id: makeId("part-note"),
      vehicleKey: vehicleKey(selectedVehicle),
      date: new Date().toISOString().slice(0, 10),
      type: "diagnostic",
      title: `Part photo note${location ? `, ${location}` : ""}`,
      notes,
      partsCost: 0,
      laborCost: 0,
      fixed: "unknown",
    }, ...entries]);
    setSaved(true);
  }

  return <div className="page narrow"><PageTitle title="Part Identifier" /><div className="page-head"><span className="eyebrow">Part identifier</span><h1>Photo part notes</h1><p>Photo identification is being prepared. You can still save a photo note with vehicle context.</p></div><SelectedVehicleCard vehicle={selectedVehicle} /><div className="card"><label>Part photo<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} /></label>{preview ? <img className="photo-preview" src={preview} alt="Selected part preview" /> : null}<label>Location hint<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Under hood, near fuel tank, fuse box" /></label><label>Symptoms or codes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="P0449, no start, fuel smell" /></label><button className="primary" disabled={!selectedVehicle || !notes.trim()} onClick={saveNote}>Save diagnostic note</button>{!selectedVehicle ? <div className="empty-card">Select a vehicle before saving a part note.</div> : null}{saved ? <div className="state loading">Part note saved on this device.</div> : null}</div></div>;
}
