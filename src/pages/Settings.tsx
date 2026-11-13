import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmDialog } from "../components/Dialog";
import { Skeleton } from "../components/Skeleton";
import { Link, navigate } from "../lib/router";
import { llmApi, voiceApi } from "../lib/endpoints";
import { displayName, signOut, updateUser } from "../lib/auth";
import { useConversations } from "../lib/conversations";
import { usePageMeta, useSession } from "../lib/hooks";
import { setMotionPref, setThemePref, useTheme } from "../lib/theme";
import type { ThemePref } from "../lib/theme";
import { useToast } from "../lib/toast";
import type { LLMProvider, LLMSettings, ProviderInfo, VoiceStatus } from "../lib/types";
import { BRAND } from "../lib/brand";

function AccountSection() {
  const session = useSession();
  const toast = useToast();
  const [name, setName] = useState(displayName(session?.user));
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    const next = name.trim();
    if (!next) return;
    setSavingName(true);
    try {
      await updateUser({ data: { display_name: next } });
      toast.success("Name updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update your name.");
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setPasswordError("Use at least 8 characters.");
    if (password !== confirm) return setPasswordError("The two passwords don't match.");
    setPasswordError(null);
    setSavingPassword(true);
    try {
      await updateUser({ password });
      setPassword("");
      setConfirm("");
      toast.success("Password changed.");
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Couldn't change your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="section" aria-labelledby="account-h">
      <div className="section__head">
        <h2 id="account-h">Account</h2>
        <p>Signed in as {session?.user.email}.</p>
      </div>
      <form className="form" onSubmit={saveName}>
        <div className="field">
          <label htmlFor="name">What should Elniv call you?</label>
          <input id="name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </div>
        <div>
          <button type="submit" className="btn" disabled={savingName || !name.trim() || name.trim() === displayName(session?.user)}>
            {savingName ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
      <form className="form" onSubmit={savePassword} noValidate>
        <div className="field">
          <label htmlFor="pw">New password</label>
          <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={!!passwordError} aria-describedby="pw-hint" />
          <span id="pw-hint" className="hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="pw2">Confirm new password</label>
          <input id="pw2" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        {passwordError && (
          <p className="error-text" role="alert">
            {passwordError}
          </p>
        )}
        <div>
          <button type="submit" className="btn" disabled={savingPassword || !password}>
            {savingPassword ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AppearanceSection() {
  const { theme, motion } = useTheme();
  const themes: { value: ThemePref; label: string }[] = [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ];
  return (
    <section className="section" aria-labelledby="look-h">
      <div className="section__head">
        <h2 id="look-h">Appearance</h2>
        <p>Saved on this device.</p>
      </div>
      <div className="field">
        <span className="label" id="theme-l">Theme</span>
        <div className="segmented" role="group" aria-labelledby="theme-l">
          {themes.map((t) => (
            <button key={t.value} type="button" aria-pressed={theme === t.value} onClick={() => setThemePref(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <label className="switch">
        <span>
          Reduce motion
          <span className="hint" style={{ display: "block" }}>Calms animations. Elniv also follows your device setting.</span>
        </span>
        <input type="checkbox" checked={motion === "reduced"} onChange={(e) => setMotionPref(e.target.checked ? "reduced" : "system")} />
        <span className="switch__track" aria-hidden="true" />
      </label>
    </section>
  );
}

function ModelSection() {
  const toast = useToast();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [saved, setSaved] = useState<LLMSettings | null>(null);
  const [custom, setCustom] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>("openrouter");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const apply = (s: LLMSettings | null) => {
    setSaved(s);
    setCustom(s?.use_custom_llm ?? false);
    setProvider(s?.provider ?? "openrouter");
    setModel(s?.model ?? "");
    setApiKey("");
  };

  useEffect(() => {
    let live = true;
    Promise.all([llmApi.providers(), llmApi.get()])
      .then(([list, current]) => {
        if (!live) return;
        setProviders(list);
        apply(current);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Couldn't load model settings.");
        setState("error");
      });
    return () => {
      live = false;
    };
  }, []);

  const hasStoredKey = saved?.has_api_key === true && saved.provider === provider;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (custom) {
      if (!model.trim()) return setFormError("Enter the model name you want to use.");
      if (!apiKey.trim() && !hasStoredKey) return setFormError("Enter your API key to use your own model.");
      if (apiKey.trim() && !/^[\x21-\x7e]+$/.test(apiKey.trim())) return setFormError("API keys contain only letters, numbers and symbols, with no spaces.");
    }
    setSaving(true);
    try {
      const next = await llmApi.save({ provider, model: model.trim() || "default", api_key: custom && apiKey.trim() ? apiKey.trim() : null, use_custom_llm: custom });
      apply(next);
      toast.success(custom ? "Your model is saved." : "Elniv will use its default model.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save your settings.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await llmApi.reset();
      apply(null);
      setConfirmReset(false);
      toast.success("Back to Elniv's default model. Your key was removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reset your settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section" aria-labelledby="model-h">
      <div className="section__head">
        <h2 id="model-h">AI model</h2>
        <p>Elniv uses a default model. If you'd rather use your own account with a supported provider, add your key here. It's encrypted on the server and never shown again.</p>
      </div>
      {state === "loading" && (
        <div style={{ display: "grid", gap: 12 }} role="status" aria-label="Loading model settings">
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      )}
      {state === "error" && (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      )}
      {state === "ready" && (
        <form className="form" onSubmit={save} noValidate>
          <label className="switch">
            <span>Use my own model and API key</span>
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
            <span className="switch__track" aria-hidden="true" />
          </label>
          {custom && (
            <>
              <div className="field">
                <label htmlFor="prov">Provider</label>
                <select id="prov" className="select" value={provider} onChange={(e) => setProvider(e.target.value as LLMProvider)}>
                  {providers
                    .filter((p) => p.supports_custom_api_key)
                    .map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.display_name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="model">Model</label>
                <input id="model" className="input" value={model} maxLength={255} onChange={(e) => setModel(e.target.value)} placeholder="Model name exactly as your provider lists it" autoComplete="off" spellCheck={false} />
              </div>
              <div className="field">
                <label htmlFor="key">API key</label>
                <input
                  id="key"
                  type="password"
                  className="input"
                  value={apiKey}
                  maxLength={1400}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasStoredKey ? "A key is saved. Enter a new one to replace it." : "Paste your key"}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="key-hint"
                />
                <span id="key-hint" className="hint">
                  <span className="status-dot" data-on={hasStoredKey} />
                  {hasStoredKey ? "Key saved and encrypted." : "No key saved yet."} Your provider bills you directly for usage.
                </span>
              </div>
            </>
          )}
          {formError && (
            <p className="error-text" role="alert">
              {formError}
            </p>
          )}
          <div className="row">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && (
              <button type="button" className="btn btn--danger" disabled={saving} onClick={() => setConfirmReset(true)}>
                Remove my settings
              </button>
            )}
          </div>
        </form>
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Remove your model settings?"
          body="Your saved API key will be deleted and Elniv will go back to its default model."
          confirmLabel="Remove"
          danger
          busy={saving}
          onConfirm={() => void reset()}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </section>
  );
}

function VoiceSection() {
  const [voice, setVoice] = useState<VoiceStatus | null | "error">(null);
  useEffect(() => {
    let live = true;
    voiceApi
      .status()
      .then((s) => live && setVoice(s))
      .catch(() => live && setVoice("error"));
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="section" aria-labelledby="voice-h">
      <div className="section__head">
        <h2 id="voice-h">Voice</h2>
        <p>Speak instead of typing. Recordings are turned into text by a speech-to-text provider, then discarded. Elniv doesn't keep your audio.</p>
      </div>
      {voice === null && <Skeleton height={20} width="60%" />}
      {voice === "error" && <p className="muted">Couldn't check voice availability right now.</p>}
      {voice && voice !== "error" && (
        <p>
          <span className="status-dot" data-on={voice.available} />
          {voice.available
            ? `Voice messages are on (speech-to-text by ${voice.provider === "groq" ? "Groq" : voice.provider === "openai" ? "OpenAI" : "your provider"}).`
            : "Voice messages aren't set up on this server yet. If you use your own OpenAI or Groq key above, voice will turn on automatically."}
        </p>
      )}
    </section>
  );
}

function DataSection() {
  const toast = useToast();
  const { removeAll, total } = useConversations();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  return (
    <section className="section" aria-labelledby="data-h">
      <div className="section__head">
        <h2 id="data-h">Your data</h2>
        <p>
          Questions or requests about your data? Write to <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.
        </p>
      </div>
      <div className="row">
        <button type="button" className="btn btn--danger" disabled={total === 0} onClick={() => setConfirm(true)}>
          Delete all conversations
        </button>
        <button type="button" className="btn" onClick={() => setSignOutConfirm(true)}>
          Sign out
        </button>
      </div>
      {total === 0 && <p className="hint">You have no conversations to delete.</p>}
      {confirm && (
        <ConfirmDialog
          title="Delete every conversation?"
          body={`All ${total} conversations and their messages will be permanently deleted. This can't be undone.`}
          confirmLabel="Delete everything"
          danger
          busy={busy}
          onConfirm={async () => {
            setBusy(true);
            try {
              await removeAll();
              setConfirm(false);
              toast.success("All conversations deleted.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't delete everything. Some conversations may remain.");
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
      {signOutConfirm && (
        <ConfirmDialog
          title="Sign out of Elniv?"
          body="You can sign back in at any time."
          confirmLabel="Sign out"
          onConfirm={async () => {
            await signOut();
            navigate("/", { replace: true });
          }}
          onCancel={() => setSignOutConfirm(false)}
        />
      )}
    </section>
  );
}

export function SettingsPage() {
  usePageMeta("Settings");
  return (
    <div className="scroll-area">
      <div className="page">
        <header className="page__head">
          <h1>Settings</h1>
          <p>
            Make Elniv yours. <Link to="/about">About &amp; safety</Link>
          </p>
        </header>
        <AccountSection />
        <AppearanceSection />
        <ModelSection />
        <VoiceSection />
        <DataSection />
      </div>
    </div>
  );
}
