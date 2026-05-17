import { Link } from "react-router-dom";
import { VehicleSelector } from "../components/VehicleSelector";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { VehicleImageCard } from "../components/VehicleImageCard";
import { FeatureCard } from "../components/FeatureCard";
import { useVehicle } from "../context/VehicleContext";
import { PageTitle } from "../components/PageTitle";

export function HomePage() {
  const { selectedVehicle } = useVehicle();
  return <div className="page home-page">
    <PageTitle title="Home" />
    <section className="hero-panel">
      <div><span className="eyebrow">AutoVinFix diagnostics</span><h1>Smart vehicle diagnosis, built for real symptoms.</h1><p>Select your vehicle, decode a VIN, look up trouble codes, and start guided diagnostics with year, make, model, and engine context.</p><Link className="primary link" to="/diagnose">Start diagnosis</Link></div>
      <div className="hero-card"><SelectedVehicleCard vehicle={selectedVehicle} /><VehicleImageCard vehicle={selectedVehicle} /></div>
    </section>
    <VehicleSelector />
    <section className="feature-grid">
      <FeatureCard icon="🧭" title="Start Smart Diagnosis" body="Use guided flow charts with vehicle-aware fuel filtering." to="/diagnose/flows" />
      <FeatureCard icon="⚠️" title="Code Lookup" body="Explain codes, severity, likely causes, and first checks." to="/diagnose/code" />
      <FeatureCard icon="🔍" title="VIN Lookup" body="Decode a VIN and save the exact vehicle to this browser." to="/vin" />
      <FeatureCard icon="🧰" title="Common Issues" body="See failure patterns reported for your year, make, and model." to="/issues" />
      <FeatureCard icon="📋" title="Recalls" body="Check safety campaigns from the backend recall route." to="/recalls" />
      <FeatureCard icon="📄" title="TSBs" body="Review technical service bulletins and known service patterns." to="/tsbs" />
      <FeatureCard icon="🔧" title="Parts" body="Open fitment-scoped parts and search hints." to="/parts" />
      <FeatureCard icon="📍" title="Shops" body="Find nearby repair shops by ZIP and issue." to="/shops" />
    </section>
  </div>;
}
