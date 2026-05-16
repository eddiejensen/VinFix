import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { VehicleSelector } from "../components/VehicleSelector";
import { useVehicle } from "../context/VehicleContext";

export function ProfilePage() {
  const { selectedVehicle, setSelectedVehicle } = useVehicle();

  return (
    <div className="page">
      <div className="page-head">
        <span className="eyebrow">Profile</span>
        <h1>Your VinFix setup</h1>
        <p>Manage the vehicle saved in this browser. Account sync and repair history are planned next.</p>
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
