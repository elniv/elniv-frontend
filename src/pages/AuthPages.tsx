import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { PublicLayout } from "../components/PublicLayout";
import { Mark } from "../components/Logo";
import { Link, navigate, useLocation } from "../lib/router";
import { AuthError, requestPasswordReset, signIn, signUp, updateUser } from "../lib/auth";
import { usePageMeta } from "../lib/hooks";
import { useToast } from "../lib/toast";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function AuthFrame({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <PublicLayout showFooter={false}>
      <div className="auth">
        <div className="auth__panel">
          <header>
            <Mark size={52} motion="float" />
            <h1>{title}</h1>
            {intro && <p>{intro}</p>}
          </header>
          {children}
        </div>
      </div>
    </PublicLayout>
  );
}

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/chat";
}

export function LoginPage() {
  usePageMeta("Sign in", { index: true });
  const { search } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(safeNext(search.get("next")), { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't sign you in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Welcome back" intro="Sign in to pick up where you left off.">
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="auth__alt">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="auth__alt">
          New to Elniv? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function SignupPage() {
  usePageMeta("Create your account", { index: true });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Tell us what to call you.");
    if (!EMAIL.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setError(null);
    setBusy(true);
    try {
      const result = await signUp(email.trim(), password, name.trim());
      if ("session" in result) navigate("/onboarding", { replace: true });
      else setSent(true);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthFrame title="Check your email" intro={`We sent a confirmation link to ${email.trim()}. Open it to finish creating your account, then sign in.`}>
        <Link to="/login" className="btn btn--primary btn--block">
          Go to sign in
        </Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create your account" intro="A calm place to think things through. It only takes a moment.">
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="name">What should we call you?</label>
          <input id="name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-describedby="pw-h" />
          <span id="pw-h" className="hint">At least 8 characters.</span>
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="auth__alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  usePageMeta("Reset your password");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Enter a valid email address.");
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't send the email. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthFrame title="Check your email" intro="If an account exists for that address, a reset link is on its way.">
        <Link to="/login" className="btn btn--block">
          Back to sign in
        </Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Reset your password" intro="Enter your email and we'll send you a link to choose a new password.">
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoFocus />
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <p className="auth__alt">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}

/** Reached from the recovery email; the session was created from the link in App. */
export function ResetPasswordPage({ hasSession }: { hasSession: boolean }) {
  usePageMeta("Choose a new password");
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hasSession) {
    return (
      <AuthFrame title="This link has expired" intro="Reset links can only be used once and expire after a while. Request a new one to continue.">
        <Link to="/forgot-password" className="btn btn--primary btn--block">
          Request a new link
        </Link>
      </AuthFrame>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setError(null);
    setBusy(true);
    try {
      await updateUser({ password });
      toast.success("Password updated.");
      navigate("/chat", { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't update your password.");
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Choose a new password">
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="pw">New password</label>
          <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="pw2">Confirm password</label>
          <input id="pw2" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthFrame>
  );
}
