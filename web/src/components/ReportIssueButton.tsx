import { Link } from "react-router-dom";
import { trackEvent } from "../utils/analytics";

const feedbackUrl = import.meta.env.VITE_TESTER_FEEDBACK_URL;

export function ReportIssueButton() {
  if (feedbackUrl) {
    return (
      <div className="report-issue-fab">
        <button
          type="button"
          className="button secondary small"
          onClick={() => {
            trackEvent("feedback_opened", { source: "fab" });
            window.open(feedbackUrl, "_blank", "noopener,noreferrer");
          }}
        >
          Report issue
        </button>
      </div>
    );
  }

  return (
    <div className="report-issue-fab">
      <Link
        className="button secondary small"
        to="/profile#report"
        onClick={() => trackEvent("feedback_opened", { source: "fab" })}
      >
        Report issue
      </Link>
    </div>
  );
}
