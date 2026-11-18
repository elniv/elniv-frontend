import { Mark } from "../components/Logo";
import { Icon } from "../components/Icon";
import { Link } from "../lib/router";
import { displayName } from "../lib/auth";
import { greeting } from "../lib/format";
import { usePageMeta, useSession } from "../lib/hooks";

export function HomePage() {
  usePageMeta("Home");
  const session = useSession();
  const name = displayName(session?.user);
  const greetText = greeting(name);

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-brand" aria-hidden="true">
          <Mark size={56} motion="float" />
        </div>

        <header className="home-header">
          <h1 className="home-title">{greetText}</h1>
          <p className="home-subtitle">Take a quiet moment to pause and notice how you are.</p>
        </header>

        <div className="home-actions">
          {/* Primary CTA */}
          <Link to="/checkin" className="btn btn--primary home-cta">
            <Icon name="pulse" size={20} />
            <span>Start a check-in</span>
          </Link>

          {/* Subtle Secondary Action */}
          <Link to="/chat" className="home-secondary-link">
            Talk to Elniv <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
