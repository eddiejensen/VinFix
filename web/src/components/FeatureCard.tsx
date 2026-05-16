import { Link } from "react-router-dom";

export function FeatureCard({ title, body, to, icon }: { title: string; body: string; to: string; icon: string }) {
  return (
    <Link to={to} className="feature-card">
      <span className="feature-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </Link>
  );
}
