import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { VehicleSelector } from "../components/VehicleSelector";
import { useVehicle } from "../context/VehicleContext";
import { PageTitle } from "../components/PageTitle";

export function ProfilePage() {
  const { selectedVehicle, setSelectedVehicle } = useVehicle();

  return (
    <div className="page">
      <PageTitle title="Profile" />
      <div className="page-head">
        <span className="eyebrow">Profile</span>
        <h1>Your AutoVinFix setup</h1>
        <p>Select a vehicle to personalize diagnostics across AutoVinFix.</p>
      </div>
      <SelectedVehicleCard vehicle={selectedVehicle} />
      {selectedVehicle ? (
        <button className="secondary danger-soft" onClick={() => setSelectedVehicle(null)}>
          Clear selected vehicle
        </button>
      ) : null}
      <VehicleSelector />
    </div>
  );
}
