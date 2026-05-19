import { useEffect } from "react";
import { FeatureCard } from "../components/FeatureCard";
import { PageTitle } from "../components/PageTitle";
import { useVehicle } from "../context/VehicleContext";
import { isVehicleComplete } from "../utils/vehicleCompleteness";
import { trackEvent } from "../utils/analytics";

const tools = [
  {
    icon: "🧭",
    title: "Guided Diagnosis",
    body: "Run guided Yes, No, Not sure steps for your symptoms.",
    to: "/diagnose/flows",
    needsEngine: true,
  },
  {
    icon: "⚠️",
    title: "Code lookup",
    body: "Look up P codes and likely causes.",
    to: "/diagnose/code",
    needsEngine: false,
  },
  {
    icon: "📷",
    title: "Identify a Part",
    body: "Upload a photo and tell us where it is on the vehicle.",
    to: "/diagnose/part-identifier",
    needsEngine: false,
  },
  {
    icon: "🧰",
    title: "Common Issues",
    body: "Known problems for your selected vehicle.",
    to: "/issues",
    needsEngine: true,
  },
  {
    icon: "📋",
    title: "Safety recalls",
    body: "Check open safety recalls for your vehicle.",
    to: "/recalls",
    needsEngine: false,
  },
  {
    icon: "📄",
    title: "Service Bulletins (TSBs)",
    body: "Review manufacturer technical service bulletins.",
    to: "/tsbs",
    needsEngine: false,
  },
  {
    icon: "🔧",
    title: "Parts Lookup",
    body: "Browse fitment scoped part categories.",
    to: "/parts",
    needsEngine: true,
  },
];

export function DiagnosePage() {
  const { selectedVehicle } = useVehicle();
  const engineReady = isVehicleComplete(selectedVehicle);

  useEffect(() => {
    trackEvent("diagnose_opened", {
      hasVehicle: Boolean(selectedVehicle),
      engineReady,
    });
  }, [selectedVehicle, engineReady]);

  return (
    <div className="page">
      <PageTitle title="Diagnose" />
      <div className="page-head">
        <span className="eyebrow">Diagnose</span>
        <h1>AutoVinFix Smart Diagnosis</h1>
        <p>Pick a tool below. Vehicle-aware tools need year, make, model, and engine selected.</p>
      </div>
      {!selectedVehicle ? (
        <div className="state warning">Select a vehicle on your Profile page before using vehicle-specific tools.</div>
      ) : null}
      {selectedVehicle && !engineReady ? (
        <div className="state warning">
          Select the engine so results match your exact vehicle. Tools that need engine details are marked below.
        </div>
      ) : null}
      <section className="feature-grid">
        {tools.map((tool) => {
          const blocked = tool.needsEngine && !engineReady;
          return (
            <FeatureCard
              key={tool.to}
              icon={tool.icon}
              title={tool.title}
              body={tool.body}
              to={tool.to}
              disabled={blocked}
              badge={blocked ? "Needs engine" : undefined}
              onClick={() => trackEvent("tool_card_clicked", { tool: tool.title, to: tool.to, blocked })}
            />
          );
        })}
      </section>
    </div>
  );
}
