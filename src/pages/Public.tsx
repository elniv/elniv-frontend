import { PublicLayout } from "../components/PublicLayout";
import { Mark } from "../components/Logo";
import { Footer } from "../components/Footer";
import { Link } from "../lib/router";
import { usePageMeta } from "../lib/hooks";
import { BRAND } from "../lib/brand";
import { configIssues } from "../lib/config";

export function LandingPage() {
  usePageMeta(null, { index: true });
  return (
    <PublicLayout>
      <section className="hero">
        <div>
          <p className="eyebrow" style={{ marginBottom: 16 }}>
            Elniv
          </p>
          <h1>A quiet place to think things through.</h1>
          <p className="lead">Talk it out with a calm companion, check in with how you really feel, and bring your own model if you'd like. No noise, no pressure.</p>
          <div className="hero__cta">
            <Link to="/chat" className="btn btn--primary">
              Talk to Elniv
            </Link>
            <Link to="/checkin" className="btn">
              Start a check-in
            </Link>
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          <Mark size={272} motion="float" />
        </div>
      </section>
      <section className="principles" aria-label="What Elniv offers">
        <div>
          <span className="eyebrow">Listen</span>
          <h2>Say it your way</h2>
          <p>Type, or speak when voice is available. Elniv answers without hurry and without judgment.</p>
        </div>
        <div>
          <span className="eyebrow">Notice</span>
          <h2>Check in with yourself</h2>
          <p>A minute each day builds a gentle picture of how you've been, and you can carry any check-in into a conversation.</p>
        </div>
        <div>
          <span className="eyebrow">Choose</span>
          <h2>Your model, your key</h2>
          <p>Use Elniv's default model, or connect your own account with OpenRouter, OpenAI, Gemini or Groq.</p>
        </div>
      </section>
      <p className="disclaimer">Elniv is an AI companion for reflection. It isn't a therapist, doesn't give medical advice, and isn't a crisis service.</p>
    </PublicLayout>
  );
}

export function AboutPage() {
  usePageMeta("About & safety", { index: true });
  return (
    <PublicLayout>
      <div className="page">
        <header className="page__head">
          <h1>About Elniv</h1>
          <p>{BRAND.description}</p>
        </header>
        <div className="prose-page">
          <h2>What Elniv is</h2>
          <p>A place to put your thoughts into words and have them reflected back with care. You can have open-ended conversations, keep short check-ins, and come back to either whenever you like.</p>
          <h2>What Elniv isn't</h2>
          <ul>
            <li>It is not a therapist, counsellor or doctor, and it can't diagnose or treat anything.</li>
            <li>It is not a crisis service. If you are in immediate danger or thinking about harming yourself, contact your local emergency number or a crisis line now.</li>
            <li>It can be wrong. Treat what it says as something to think about, not as advice you must follow.</li>
          </ul>
          <h2>Your conversations and data</h2>
          <ul>
            <li>Conversations and check-ins are saved to your account so you can return to them. You can delete any conversation or check-in, or every conversation at once, from the app.</li>
            <li>Messages are sent to a language model to generate replies. By default that is Elniv's model; if you add your own key in Settings, your chosen provider receives them instead.</li>
            <li>An API key you add is encrypted before it is stored and is never shown again.</li>
            <li>Voice messages are sent to a speech-to-text provider and turned into text. The audio itself isn't saved.</li>
          </ul>
          <h2>Get in touch</h2>
          <p>
            Questions, feedback or data requests: <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

export function NotFoundPage({ signedIn }: { signedIn: boolean }) {
  usePageMeta("Page not found");
  return (
    <PublicLayout showFooter={false}>
      <div className="center-screen" style={{ background: "none", minHeight: "60dvh" }}>
        <div>
          <Mark size={72} motion="float" />
          <h1>We couldn't find that page</h1>
          <p>The link may be old, or the page may have moved.</p>
          <Link to={signedIn ? "/chat" : "/"} className="btn btn--primary">
            {signedIn ? "Back to Elniv" : "Go home"}
          </Link>
        </div>
      </div>
      <Footer compact />
    </PublicLayout>
  );
}

export function ConfigMissingPage() {
  const missing = configIssues();
  return (
    <div className="center-screen">
      <div>
        <Mark size={72} />
        <h1>Elniv isn't configured yet</h1>
        <p>This build is missing required settings. Set the following variables and rebuild:</p>
        <ul className="prose-page" style={{ textAlign: "left" }}>
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="small faint">See .env.example in the repository.</p>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="center-screen" role="status" aria-label="Loading Elniv">
      <div>
        <Mark size={72} motion="think" />
      </div>
    </div>
  );
}
