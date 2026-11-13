import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppShell } from "./components/AppShell";
import { ConfigMissingPage, LandingPage, LoadingScreen, NotFoundPage, AboutPage } from "./pages/Public";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from "./pages/AuthPages";
import { ConversationsProvider } from "./lib/conversations";
import { consumeAuthRedirect, isOnboarded, refreshSession, watchOtherTabs } from "./lib/auth";
import { configIssues } from "./lib/config";
import { useSession } from "./lib/hooks";
import { matchRoute, navigate, useLocation } from "./lib/router";
import { useToast } from "./lib/toast";

// Heavier screens load on demand.
const ChatPage = lazy(() => import("./pages/Chat").then((m) => ({ default: m.ChatPage })));
const CheckinsPage = lazy(() => import("./pages/Checkins").then((m) => ({ default: m.CheckinsPage })));
const SettingsPage = lazy(() => import("./pages/Settings").then((m) => ({ default: m.SettingsPage })));
const OnboardingPage = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.OnboardingPage })));

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return <LoadingScreen />;
}

function Protected({ children }: { children: ReactNode }) {
  const session = useSession();
  const { pathname, search } = useLocation();
  if (!session) {
    const next = encodeURIComponent(pathname + (search.toString() ? `?${search.toString()}` : ""));
    return <Redirect to={`/login?next=${next}`} />;
  }
  return <>{children}</>;
}

function AppArea({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session && !isOnboarded(session.user)) return <Redirect to="/onboarding" />;
  return (
    <ConversationsProvider>
      <AppShell>
        <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
      </AppShell>
    </ConversationsProvider>
  );
}

export function App() {
  const toast = useToast();
  const session = useSession();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);

  // On startup: handle email-link redirects (confirmation, recovery) and refresh a stale session.
  useEffect(() => {
    watchOtherTabs();
    let live = true;
    (async () => {
      try {
        const result = await consumeAuthRedirect();
        if (result && "error" in result) toast.error(result.error);
        else if (result?.type === "recovery") navigate("/reset-password", { replace: true });
        else if (result?.type === "signup") toast.success("Email confirmed. Welcome to Elniv.");
        else await refreshSession().catch(() => null);
      } catch {
        toast.error("That link didn't work. Please request a new one.");
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (configIssues().length > 0) return <ConfigMissingPage />;
  if (!ready) return <LoadingScreen />;

  const signedIn = session !== null;
  const guestOnly = (page: ReactNode) => (signedIn ? <Redirect to="/chat" /> : page);

  if (pathname === "/") return <LandingPage />;
  if (pathname === "/about") return <AboutPage />;
  if (pathname === "/login") return guestOnly(<LoginPage />);
  if (pathname === "/signup") return guestOnly(<SignupPage />);
  if (pathname === "/forgot-password") return <ForgotPasswordPage />;
  if (pathname === "/reset-password") return <ResetPasswordPage hasSession={signedIn} />;

  if (pathname === "/onboarding") {
    return (
      <Protected>
        {session && isOnboarded(session.user) ? (
          <Redirect to="/chat" />
        ) : (
          <Suspense fallback={<LoadingScreen />}>
            <OnboardingPage />
          </Suspense>
        )}
      </Protected>
    );
  }

  if (pathname === "/chat" || matchRoute("/chat/:id", pathname)) {
    return (
      <Protected>
        <AppArea>
          <ChatPage />
        </AppArea>
      </Protected>
    );
  }
  if (pathname === "/checkins") {
    return (
      <Protected>
        <AppArea>
          <CheckinsPage />
        </AppArea>
      </Protected>
    );
  }
  if (pathname === "/settings") {
    return (
      <Protected>
        <AppArea>
          <SettingsPage />
        </AppArea>
      </Protected>
    );
  }

  return <NotFoundPage signedIn={signedIn} />;
}
