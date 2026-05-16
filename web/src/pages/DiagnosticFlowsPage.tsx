import { visibleFlowsForFuel } from "../data/diagnosticFlows";
import { useVehicle } from "../context/VehicleContext";
import { FuelTypeBadge } from "../components/FuelTypeBadge";

export function DiagnosticFlowsPage() {
  const { selectedVehicle } = useVehicle();
  const flows = visibleFlowsForFuel(selectedVehicle?.fuelType);
  return <div className="page"><div className="page-head"><span className="eyebrow">Flow charts</span><h1>Guided diagnostic flows</h1><p>{selectedVehicle ? <>Filtered for <FuelTypeBadge fuelType={selectedVehicle.fuelType} /></> : "Showing general guides, select a vehicle for smarter filtering."}</p></div>
    <div className="flow-grid">{flows.map((flow) => <article className="flow-card" key={flow.id}><span className="badge">{flow.category}</span><h3>{flow.title}</h3><p>{flow.description}</p><div>{flow.codes.map((code) => <span className="badge orange" key={code}>{code}</span>)}</div><h4>First checks</h4><ul>{flow.firstChecks.map((check) => <li key={check}>{check}</li>)}</ul></article>)}</div>
  </div>;
}
