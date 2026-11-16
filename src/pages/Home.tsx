import { Mark } from "../components/Logo";
import { Icon } from "../components/Icon";
import { Link } from "../lib/router";
import { usePageMeta, useSession } from "../lib/hooks";
import { displayName } from "../lib/auth";
import { greeting } from "../lib/format";

export function HomePage() {
  const session = useSession();
  const name = displayName(session?.user);
  usePageMeta("Home · Elniv");

  return (
    <div className="home-screen">
      <div className="home-screen__center">
        <div className="home-screen__mark" aria-hidden="true">
          <Mark size={88} motion="float" />
        </div>

        <div className="home-screen__copy">
          <p className="eyebrow" style={{ letterSpacing: "0.14em", marginBottom: 6 }}>
            Quiet Space
          </p>
          <h1 className="home-screen__title">{greeting(name)}</h1>
          <p className="home-screen__lead">
            Take a pause. Notice how you feel, express what is on your mind, and find clarity without hurry.
          </p>
        </div>

        <div className="home-screen__actions">
          <Link to="/checkin" className="btn btn--primary home-screen__cta">
            <Icon name="spark" size={19} />
            <span>Start a check-in</span>
          </Link>

          <Link to="/chat" className="home-screen__subtle-link">
            <Icon name="chat" size={16} />
            <span>Talk to Elniv</span>
          </Link>
        </div>

        <div className="home-screen__foot-links">
          <Link to="/activities" className="home-screen__pill-link">
            <Icon name="wind" size={15} />
            <span>Activities & Reset</span>
          </Link>
          <span className="home-screen__divider" aria-hidden="true">·</span>
          <Link to="/checkins" className="home-screen__pill-link">
            <Icon name="pulse" size={15} />
            <span>Check-in history</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
