import { useState } from "react";
import type { FormEvent } from "react";
import { Mark } from "../components/Logo";
import { navigate } from "../lib/router";
import { displayName, updateUser } from "../lib/auth";
import { usePageMeta, useSession } from "../lib/hooks";

const INTENTS = [
  { value: "stress", label: "Feeling overwhelmed" },
  { value: "decision", label: "Making a decision" },
  { value: "feelings", label: "Understanding my feelings" },
  { value: "growth", label: "Building better habits" },
  { value: "default", label: "Just exploring" },
] as const;

export function OnboardingPage() {
  usePageMeta("Welcome");
  const session = useSession();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(displayName(session?.user));
  const [intent, setIntent] = useState<string>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateUser({ data: { display_name: name.trim(), intent, onboarded: true } });
      const next = new URLSearchParams(window.location.search).get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
      navigate(target, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="onboard__panel">
        <div className="steps" role="img" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <i key={i} data-on={i <= step} />
          ))}
        </div>

        {step === 0 && (
          <form
            className="stage"
            key="s0"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(1);
            }}
          >
            <Mark size={64} motion="float" />
            <h1>Hello. I'm Elniv.</h1>
            <p className="muted">I'm here to listen and help you think things through. What should I call you?</p>
            <div className="field">
              <label htmlFor="n">Your name</label>
              <input id="n" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus />
            </div>
            <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
              Continue
            </button>
          </form>
        )}

        {step === 1 && (
          <div className="stage" key="s1">
            <h1>What brings you here, {name.trim()}?</h1>
            <p className="muted">Pick whatever is closest. It only shapes the suggestions you see when you start a conversation.</p>
            <div className="chips" role="radiogroup" aria-label="What brings you here">
              {INTENTS.map((item) => (
                <button key={item.value} type="button" role="radio" aria-checked={intent === item.value} className="chip" onClick={() => setIntent(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form className="stage" key="s2" onSubmit={finish}>
            <h1>A few honest things</h1>
            <ul className="prose-page" style={{ paddingLeft: "1.1em", color: "var(--text-2)" }}>
              <li>I'm an AI, not a therapist. I can help you reflect, but I can't diagnose or treat anything.</li>
              <li>If you're ever in danger or thinking of harming yourself, please contact your local emergency number or a crisis line right away.</li>
              <li>Your conversations are saved to your account so you can return to them. You can delete any of them, or all of them, in Settings.</li>
              <li>You can switch to your own model and API key in Settings, and speak instead of typing when voice is available.</li>
            </ul>
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}
            <div className="row">
              <button type="button" className="btn" onClick={() => setStep(1)} disabled={busy}>
                Back
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "One moment…" : "I understand, let's begin"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
