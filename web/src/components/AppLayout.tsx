import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useVehicle } from "../context/VehicleContext";
import { BetaBanner } from "./BetaBanner";
import { ReportIssueButton } from "./ReportIssueButton";
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
  ["/todos", "To Dos", "✅"],
  ["/costs", "Costs", "💵"],
];

export function AppLayout() {
  const { selectedVehicle } = useVehicle();
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>AVF</span><div><strong>AutoVinFix</strong><small>Smart Diagnosis</small></div></div>
        <nav>
          {links.map(([to, label, icon]) => <NavLink key={to} to={to}>{icon} {label}</NavLink>)}
          {secondaryLinks.map(([to, label, icon]) => <NavLink key={to} to={to}>{icon} {label}</NavLink>)}
          {!user ? <NavLink to="/login">🔐 Login</NavLink> : null}
        </nav>
        {user ? <div className="account-chip">Signed in<br /><strong>{user.email}</strong></div> : null}
      </aside>
      <div className="main-area">
        <BetaBanner />
        <header className="topbar">
          <SelectedVehicleCard vehicle={selectedVehicle} compact />
        </header>
        <main><Outlet /></main>
        <ReportIssueButton />
      </div>
      <nav className="mobile-tabs">{links.map(([to, label, icon]) => <NavLink key={to} to={to}><span>{icon}</span>{label}</NavLink>)}</nav>
    </div>
  );
}
