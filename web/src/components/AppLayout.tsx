import { NavLink, Outlet } from "react-router-dom";
import { useVehicle } from "../context/VehicleContext";
import { SelectedVehicleCard } from "./SelectedVehicleCard";

const links = [
  ["/", "Home", "🏠"],
  ["/diagnose", "Diagnose", "🧭"],
  ["/history", "History", "🧾"],
  ["/shops", "Shops", "📍"],
  ["/profile", "Profile", "👤"],
];

const secondaryLinks = [
  ["/garage", "Garage", "🚗"],
  ["/todos", "To-Dos", "✅"],
  ["/costs", "Costs", "💵"],
];

export function AppLayout() {
  const { selectedVehicle } = useVehicle();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>VF</span><div><strong>VinFix</strong><small>Smart Diagnosis</small></div></div>
        <nav>
          {links.map(([to, label, icon]) => <NavLink key={to} to={to}>{icon} {label}</NavLink>)}
          {secondaryLinks.map(([to, label, icon]) => <NavLink key={to} to={to}>{icon} {label}</NavLink>)}
        </nav>
      </aside>
      <div className="main-area">
        {selectedVehicle ? <header className="topbar"><SelectedVehicleCard vehicle={selectedVehicle} compact /></header> : null}
        <main><Outlet /></main>
      </div>
      <nav className="mobile-tabs">{links.map(([to, label, icon]) => <NavLink key={to} to={to}><span>{icon}</span>{label}</NavLink>)}</nav>
    </div>
  );
}
