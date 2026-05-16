import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { CommonIssueCards } from "../components/CommonIssueCards";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { visibleFlowsForFuel } from "../data/diagnosticFlows";
import { useVehicle } from "../context/VehicleContext";
import { FuelTypeBadge } from "../components/FuelTypeBadge";
import type { CommonIssue } from "../types";

export function DiagnosticFlowsPage() {
  const { selectedVehicle } = useVehicle();
  const flows = visibleFlowsForFuel(selectedVehicle?.fuelType);
  const [activeFlowId, setActiveFlowId] = useState(flows[0]?.id || "");
  const [nodeId, setNodeId] = useState("start");
  const [answers, setAnswers] = useState<string[]>([]);
  const [issues, setIssues] = useState<CommonIssue[]>([]);
  const [issueError, setIssueError] = useState("");

  useEffect(() => {
    if (!flows.some((flow) => flow.id === activeFlowId)) {
      setActiveFlowId(flows[0]?.id || "");
      setNodeId("start");
      setAnswers([]);
    }
  }, [activeFlowId, flows]);

  useEffect(() => {
    if (!selectedVehicle) {
      setIssues([]);
      return;
    }

    api.commonIssues(selectedVehicle)
      .then(setIssues)
      .catch(() => setIssueError("Common issue data is not available right now."));
  }, [selectedVehicle?.year, selectedVehicle?.make, selectedVehicle?.model]);

  const activeFlow = useMemo(
    () => flows.find((flow) => flow.id === activeFlowId) || flows[0],
    [activeFlowId, flows]
  );
  const node = activeFlow?.nodes[nodeId];

  function answer(label: string, next?: string) {
    if (!next || !activeFlow) return;
    setAnswers((prev) => [...prev, label]);
    setNodeId(next);
  }

  function resetFlow(flowId = activeFlow?.id || "") {
    setActiveFlowId(flowId);
    setNodeId("start");
    setAnswers([]);
  }

  const matchedIssues = issues.filter((issue) => {
    const text = [issue.title, issue.issue, issue.component, issue.summary, issue.symptomTrigger, issue.commonFix]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return activeFlow?.commonSignals.some((term) => text.includes(term.toLowerCase()));
  });

  return (
    <div className="page">
      <div className="page-head">
        <span className="eyebrow">Flow charts</span>
        <h1>Guided diagnostic flows</h1>
        <p>{selectedVehicle ? <>Filtered for <FuelTypeBadge fuelType={selectedVehicle.fuelType} /></> : "Showing general guides. Select a vehicle for smarter filtering."}</p>
      </div>

      <SelectedVehicleCard vehicle={selectedVehicle} />

      <div className="flow-grid">
        {flows.map((flow) => (
          <button
            className={flow.id === activeFlow?.id ? "flow-card flow-card-button active" : "flow-card flow-card-button"}
            key={flow.id}
            onClick={() => resetFlow(flow.id)}
            type="button"
          >
            <span className="badge">{flow.category}</span>
            <h3>{flow.title}</h3>
            <p>{flow.description}</p>
          </button>
        ))}
      </div>

      {activeFlow && node ? (
        <section className="diagnostic-workspace">
          <article className="card">
            <div className="result-header">
              <div>
                <span className="eyebrow">Active flow</span>
                <h2>{activeFlow.title}</h2>
              </div>
              <FuelTypeBadge fuelType={selectedVehicle?.fuelType || "unknown"} />
            </div>

            {node.question ? (
              <>
                <p className="question-text">{node.question}</p>
                <div className="button-row wrap">
                  <button className="primary" onClick={() => answer("Yes", node.yes)}>Yes</button>
                  <button className="secondary" onClick={() => answer("No", node.no)}>No</button>
                  <button className="secondary" onClick={() => answer("Not sure", node.notSure)}>Not Sure</button>
                  <button className="secondary" onClick={() => answer("Skip", node.skip)}>Skip</button>
                </div>
              </>
            ) : (
              <div className="result-card">
                <span className="badge orange">Final summary</span>
                <h3>{node.resultTitle}</h3>
                <h4>Likely causes</h4>
                <ul>{node.likelyCauses?.map((cause) => <li key={cause}>{cause}</li>)}</ul>
                <h4>Next best checks</h4>
                <ul>{node.nextBestChecks?.map((check) => <li key={check}>{check}</li>)}</ul>
                <button className="secondary" onClick={() => resetFlow()} type="button">Restart this flow</button>
              </div>
            )}

            {answers.length ? <p className="muted">Answers: {answers.join(" / ")}</p> : null}
          </article>

          <aside className="card">
            <span className="eyebrow">Common for this vehicle</span>
            {!selectedVehicle ? (
              <div className="empty-card">Select a vehicle to see common issue patterns beside each flow.</div>
            ) : issueError ? (
              <div className="state error">{issueError}</div>
            ) : (
              <CommonIssueCards issues={matchedIssues.length ? matchedIssues.slice(0, 3) : issues.slice(0, 3)} />
            )}
          </aside>
        </section>
      ) : null}
    </div>
  );
}
