import type { ReactNode } from "react";
import { Brand } from "./Logo";
import { Footer } from "./Footer";
import { Link } from "../lib/router";
import { useSession } from "../lib/hooks";

export function PublicLayout({ children, showFooter = true }: { children: ReactNode; showFooter?: boolean }) {
  const signedIn = useSession() !== null;
  return (
    <div className="public">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="public__bar">
        <Brand />
        <nav aria-label="Primary">
          <Link to="/about" className="btn btn--ghost btn--sm">
            About
          </Link>
          {signedIn ? (
            <Link to="/chat" className="btn btn--primary btn--sm">
              Open Elniv
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--sm">
                Sign in
              </Link>
              <Link to="/signup" className="btn btn--primary btn--sm">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="public__main">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
