import { NavLink, Outlet } from "react-router-dom";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "./SelectedVehicleCard";

const links = [
  ["/", "Home"],
  ["/diagnose", "Diagnose"],
  ["/vin", "VIN"],
  ["/diagnose/code", "Codes"],
  ["/issues", "Issues"],
  ["/shops", "Shops"],
  ["/history", "History"],
];

export function AppLayout() {
  const { selectedVehicle } = useVehicle();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>VF</span><div><strong>VinFix</strong><small>Smart Diagnosis</small></div></div>
        <nav>{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
      </aside>
      <div className="main-area">
        <header className="topbar"><SelectedVehicleCard vehicle={selectedVehicle} compact /></header>
        <main><Outlet /></main>
      </div>
      <nav className="mobile-tabs">{links.slice(0,5).map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
    </div>
  );
}
