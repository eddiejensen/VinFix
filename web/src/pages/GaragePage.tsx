import { useEffect, useState } from "react";
import { PageTitle } from "../components/PageTitle";
import { SelectedVehicleCard, vehicleName } from "../components/SelectedVehicleCard";
import { useVehicle } from "../context/VehicleContext";
import type { SelectedVehicle } from "../types";
import { CLOUD_DATA_RESTORE_EVENT, readLocalArray, STORAGE_KEYS, vehicleKey, writeLocalArray } from "../utils/localData";

export function GaragePage() {
  const { selectedVehicle, setSelectedVehicle } = useVehicle();
  const [garage, setGarage] = useState<SelectedVehicle[]>(() => readLocalArray(STORAGE_KEYS.garage));

  useEffect(() => writeLocalArray(STORAGE_KEYS.garage, garage), [garage]);
  useEffect(() => {
    const reload = () => setGarage(readLocalArray(STORAGE_KEYS.garage));
    window.addEventListener(CLOUD_DATA_RESTORE_EVENT, reload);
    return () => window.removeEventListener(CLOUD_DATA_RESTORE_EVENT, reload);
  }, []);

  function addCurrentVehicle() {
    if (!selectedVehicle) return;
    setGarage((prev) => {
      const key = vehicleKey(selectedVehicle);
      if (prev.some((item) => vehicleKey(item) === key)) return prev;
      return [{ ...selectedVehicle, id: key }, ...prev];
    });
  }

  return (
    <div className="page">
      <PageTitle title="Garage" />
      <div className="page-head">
        <span className="eyebrow">Garage</span>
        <h1>Saved vehicles</h1>
        <p>Keep vehicles in your account and switch between them quickly.</p>
      </div>
      <SelectedVehicleCard vehicle={selectedVehicle} />
      <button className="primary" disabled={!selectedVehicle} onClick={addCurrentVehicle}>Add current vehicle to garage</button>
      <div className="stack">
        {garage.length === 0 ? <div className="empty-card">No saved vehicles yet.</div> : null}
        {garage.map((vehicle) => (
          <article className="issue-card" key={vehicleKey(vehicle)}>
            <h3>{vehicleName(vehicle)}</h3>
            <p>{[vehicle.engine, vehicle.drivetrain].filter(Boolean).join(", ") || "Vehicle details saved"}</p>
            <div className="button-row wrap">
              <button className="primary" onClick={() => setSelectedVehicle(vehicle)}>Set active</button>
              <button className="secondary danger-soft" onClick={() => setGarage((prev) => prev.filter((item) => vehicleKey(item) !== vehicleKey(vehicle)))}>Remove</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
