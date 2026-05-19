import { Link } from "react-router-dom";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { VehicleSelector } from "../components/VehicleSelector";
import { useAuth } from "../context/AuthContext";
import { useVehicle } from "../context/VehicleContext";
import { PageTitle } from "../components/PageTitle";

export function ProfilePage() {
  const { selectedVehicle, setSelectedVehicle } = useVehicle();
  const { user, loading, logout, syncNow } = useAuth();

  return (
    <div className="page">
      <PageTitle title="Profile" />
      <div className="page-head">
        <span className="eyebrow">Profile</span>
        <h1>Your AutoVinFix setup</h1>
        <p>Select a vehicle to personalize diagnostics across AutoVinFix.</p>
      </div>
      <div className="card">
        <div className="result-header">
          <div>
            <span className="eyebrow">Account</span>
            <h2>{user ? "Signed in" : "Save your AutoVinFix data"}</h2>
            <p className="muted">
              {user
                ? `${user.email} is backing up saved vehicles, history, to-dos, costs, and notes.`
                : "Log in to save your garage, repair history, to-dos, costs, and diagnostic notes to your account."}
            </p>
          </div>
          {user ? <span className="badge orange">Account sync on</span> : <span className="badge">Local only</span>}
        </div>
        <div className="button-row wrap">
          {user ? (
            <>
              <button className="primary" disabled={loading} onClick={() => syncNow()}>Sync now</button>
              <button className="secondary danger-soft" onClick={logout}>Log out</button>
            </>
          ) : (
            <Link className="primary link" to="/login">Log in</Link>
          )}
        </div>
      </div>
      <SelectedVehicleCard vehicle={selectedVehicle} />
      {selectedVehicle ? (
        <button className="secondary danger-soft" onClick={() => setSelectedVehicle(null)}>
          Clear selected vehicle
        </button>
      ) : null}
      <div className="card" id="report">
        <span className="eyebrow">Tester feedback</span>
        <h2>Report issue or suggest improvement</h2>
        <p className="muted">
          Tell us what you clicked, what you expected, and what happened. Your session is tracked anonymously so we can match feedback to app usage.
        </p>
        {import.meta.env.VITE_TESTER_FEEDBACK_URL ? (
          <a
            className="primary link"
            href={import.meta.env.VITE_TESTER_FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open tester feedback form
          </a>
        ) : (
          <p className="muted">Set VITE_TESTER_FEEDBACK_URL to link your Google Sheet or form here.</p>
        )}
      </div>
      <VehicleSelector />
    </div>
  );
}
