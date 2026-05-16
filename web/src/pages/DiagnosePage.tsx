import { FeatureCard } from "../components/FeatureCard";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { useVehicle } from "../context/VehicleContext";
import { PageTitle } from "../components/PageTitle";

export function DiagnosePage() {
  const { selectedVehicle } = useVehicle();
  return <div className="page"><PageTitle title="Diagnose" /><div className="page-head"><span className="eyebrow">Diagnose</span><h1>VinFix Smart Diagnosis</h1><p>Pick a tool below. Vehicle-aware results appear when a vehicle is selected.</p></div><SelectedVehicleCard vehicle={selectedVehicle} />
    <section className="feature-grid">
      <FeatureCard icon="🧭" title="Diagnostic flow charts" body="Run guided Yes, No, Not sure steps." to="/diagnose/flows" />
      <FeatureCard icon="⚠️" title="Code lookup" body="Look up P codes and likely causes." to="/diagnose/code" />
      <FeatureCard icon="📷" title="Identify a Part" body="Stage a photo and location hint for part identification." to="/diagnose/part-identifier" />
      <FeatureCard icon="🧰" title="Common issues" body="Common failures for selected vehicle." to="/issues" />
      <FeatureCard icon="📋" title="Recalls and TSBs" body="Check safety recalls and service bulletins." to="/recalls" />
      <FeatureCard icon="📄" title="TSBs" body="Review known service bulletins." to="/tsbs" />
      <FeatureCard icon="🔧" title="Parts Lookup" body="Browse fitment scoped part categories." to="/parts" />
    </section>
  </div>;
}
