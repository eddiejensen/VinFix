import { Link } from "react-router-dom";
import { VehicleSelector } from "../components/VehicleSelector";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { VehicleImageCard } from "../components/VehicleImageCard";
import { FeatureCard } from "../components/FeatureCard";
import { useVehicle } from "../context/VehicleContext";

export function HomePage() {
  const { selectedVehicle } = useVehicle();
  return <div className="page home-page">
    <section className="hero-panel">
      <div><span className="eyebrow">VinFix web beta</span><h1>Smart vehicle diagnosis, built for real symptoms.</h1><p>Select your vehicle, decode a VIN, look up trouble codes, and start guided diagnostics with year, make, model, and engine context.</p><Link className="primary link" to="/diagnose">Start diagnosis</Link></div>
      <div className="hero-card"><SelectedVehicleCard vehicle={selectedVehicle} /><VehicleImageCard vehicle={selectedVehicle} /></div>
    </section>
    <VehicleSelector />
    <section className="feature-grid">
      <FeatureCard icon="🧭" title="Diagnostic flows" body="Guided questions based on symptom and fuel type." to="/diagnose/flows" />
      <FeatureCard icon="⚠️" title="Code lookup" body="Explain codes, severity, and first checks." to="/diagnose/code" />
      <FeatureCard icon="🔍" title="VIN lookup" body="Decode VIN and set your selected vehicle." to="/vin" />
      <FeatureCard icon="🧰" title="Common issues" body="See common patterns for your vehicle." to="/issues" />
      <FeatureCard icon="📋" title="Recalls and TSBs" body="Review safety recalls and service resources." to="/recalls" />
      <FeatureCard icon="📍" title="Find shops" body="Search local repair shops by ZIP." to="/shops" />
    </section>
  </div>;
}
