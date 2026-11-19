import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppShell } from "./components/AppShell";
import { PublicLayout } from "./components/PublicLayout";
import { ConfigMissingPage, LandingPage, LoadingScreen, NotFoundPage, AboutPage } from "./pages/Public";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage, safeNext } from "./pages/AuthPages";
import { ConversationsProvider } from "./lib/conversations";
import { consumeAuthRedirect, isOnboarded, refreshSession, watchOtherTabs } from "./lib/auth";
import { configIssues } from "./lib/config";
import { checkinsApi } from "./lib/endpoints";
import { useSession } from "./lib/hooks";
import { matchRoute, navigate, useLocation } from "./lib/router";
import { useToast } from "./lib/toast";

const PENDING_CHECKIN_STORAGE_KEY = "elniv_pending_checkin";

// Heavier screens load on demand.
const HomePage = lazy(() => import("./pages/Home").then((m) => ({ default: m.HomePage })));
const CheckinFlowPage = lazy(() => import("./pages/CheckinFlow").then((m) => ({ default: m.CheckinFlowPage })));
const ChatPage = lazy(() => import("./pages/Chat").then((m) => ({ default: m.ChatPage })));
const SettingsPage = lazy(() => import("./pages/Settings").then((m) => ({ default: m.SettingsPage })));
const OnboardingPage = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.OnboardingPage })));
const ActivitiesPage = lazy(() => import("./pages/Activities").then((m) => ({ default: m.ActivitiesPage })));

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return <LoadingScreen />;
}

function Protected({ children }: { children: ReactNode }) {
  const session = useSession();
  const { pathname, search } = useLocation();
  if (!session) {
    const searchStr = search.toString();
    const destination = pathname + (searchStr ? `?${searchStr}` : "");
    const next = searchStr ? encodeURIComponent(destination) : destination;
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
  const { pathname, search } = useLocation();
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

  // Post-auth: Automatically save pending check-in data after login/signup
  useEffect(() => {
    if (!session) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(PENDING_CHECKIN_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      localStorage.removeItem(PENDING_CHECKIN_STORAGE_KEY);
      void checkinsApi.create(data).then(() => {
        toast.success("Check-in saved.");
      }).catch((e) => {
        console.warn("Couldn't save pending check-in:", e);
      });
    } catch {
      try {
        localStorage.removeItem(PENDING_CHECKIN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [session, toast]);

  if (configIssues().length > 0) return <ConfigMissingPage />;
  if (!ready) return <LoadingScreen />;

  const signedIn = session !== null;
  const guestOnly = (page: ReactNode) => (signedIn ? <Redirect to={safeNext(search.get("next"))} /> : page);

  if (pathname === "/home" || (pathname === "/" && signedIn)) {
    return (
      <Protected>
        <AppArea>
          <HomePage />
        </AppArea>
      </Protected>
    );
  }
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
          <Redirect to="/home" />
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
  if (pathname === "/checkin") {
    return signedIn ? (
      <AppArea>
        <CheckinFlowPage />
      </AppArea>
    ) : (
      <PublicLayout showFooter={false}>
        <Suspense fallback={<LoadingScreen />}>
          <CheckinFlowPage />
        </Suspense>
      </PublicLayout>
    );
  }
  if (pathname === "/checkins") {
    return <Redirect to={signedIn ? "/home" : "/"} />;
  }
  if (pathname === "/activities") {
    return (
      <Protected>
        <AppArea>
          <ActivitiesPage />
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
