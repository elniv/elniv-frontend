import { Brand } from "./Logo";
import { Link } from "../lib/router";
import { BRAND } from "../lib/brand";
import { useSession } from "../lib/hooks";

export function Footer({ compact = false }: { compact?: boolean }) {
  const signedIn = useSession() !== null;
  return (
    <footer className={`footer ${compact ? "footer--compact" : ""}`.trim()}>
      <div className="footer__in">
        <div>
          <Brand />
          <p>{BRAND.description} Talk things through, check in with yourself, and choose the model behind it.</p>
        </div>
        <nav aria-label="Elniv">
          <h2>Explore</h2>
          <ul>
            <li>
              <Link to={signedIn ? "/chat" : "/signup"}>Talk with Elniv</Link>
            </li>
            {signedIn && (
              <li>
                <Link to="/checkins">Check in</Link>
              </li>
            )}
            <li>
              <Link to="/about">About &amp; safety</Link>
            </li>
            {!signedIn && (
              <li>
                <Link to="/login">Sign in</Link>
              </li>
            )}
          </ul>
        </nav>
        <div>
          <h2>Contact</h2>
          <ul>
            <li>
              <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
            </li>
          </ul>
        </div>
        <p className="footer__legal" style={{ maxWidth: "none", marginTop: 0 }}>
          © {new Date().getFullYear()} Elniv. Elniv is not a therapist or a crisis service. If you are in immediate danger, contact your local emergency number.
        </p>
      </div>
    </footer>
  );
}
