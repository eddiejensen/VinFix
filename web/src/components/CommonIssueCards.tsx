import type { CommonIssue } from "../types";

export function CommonIssueCards({ issues }: { issues: CommonIssue[] }) {
  if (!issues.length) return <div className="empty-card">No common issues returned yet.</div>;
  return <div className="stack">{issues.map((issue, idx) => (
    <article className="issue-card" key={issue.id || idx}>
      <span className="badge">Common issue</span>
      <h3>{issue.title || issue.issue || issue.component || "Issue"}</h3>
      <p>{issue.summary || issue.symptomTrigger || issue.supportingDetail || "No summary available"}</p>
      {issue.commonFix && <p><strong>Common fix,</strong> {issue.commonFix}</p>}
      {issue.complaintCount && <span className="badge orange">Complaint count, {issue.complaintCount}</span>}
    </article>
  ))}</div>;
}
