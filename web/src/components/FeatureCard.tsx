import { Link } from "react-router-dom";

type FeatureCardProps = {
  title: string;
  body: string;
  to: string;
  icon: string;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
};

export function FeatureCard({ title, body, to, icon, disabled, badge, onClick }: FeatureCardProps) {
  const content = (
    <>
      <span className="feature-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{body}</p>
      {badge ? <span className="badge">{badge}</span> : null}
    </>
  );

  if (disabled) {
    return (
      <article className="feature-card disabled" aria-disabled="true">
        {content}
      </article>
    );
  }

  return (
    <Link to={to} className="feature-card" onClick={onClick}>
      {content}
    </Link>
  );
}
