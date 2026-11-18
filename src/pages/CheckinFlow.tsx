import { useEffect, useState } from "react";
import { Mark } from "../components/Logo";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Skeleton";
import { Markdown } from "../lib/markdown";
import { Link } from "../lib/router";
import { checkinsApi, chatApi, voiceApi } from "../lib/endpoints";
import { useVoiceRecorder, extensionFor } from "../lib/voice";
import { formatDuration } from "../lib/format";
import { usePageMeta, useSession } from "../lib/hooks";
import { displayName } from "../lib/auth";
import { useToast } from "../lib/toast";

const EMOTIONS = [
  "Calm",
  "Anxious",
  "Overwhelmed",
  "Sad",
  "Numb",
  "Grateful",
  "Hopeful",
  "Tired",
  "Restless",
  "Content",
  "Lonely",
  "Frustrated",
] as const;

const CONTEXT_FACTORS = [
  "Work & Career",
  "Relationships",
  "Sleep & Energy",
  "Health & Body",
  "Family",
  "Finances",
  "A Big Decision",
  "Personal Growth",
  "Daily Routine",
  "Something Else",
] as const;

type Step = 1 | 2 | 3 | 4;

export function CheckinFlowPage() {
  usePageMeta("Guided Check-in");
  const session = useSession();
  const toast = useToast();
  const userName = displayName(session?.user);

  const [step, setStep] = useState<Step>(1);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [expression, setExpression] = useState("");

  // Voice recording & transcription state
  const recorder = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  // Submission & AI Reflection state
  const [saving, setSaving] = useState(false);
  const [reflection, setReflection] = useState<string | null>(null);
  const [convoId, setConvoId] = useState<string | null>(null);

  // Check backend voice transcription capability
  useEffect(() => {
    let live = true;
    voiceApi
      .status()
      .then((s) => live && setVoiceAvailable(s.available))
      .catch(() => live && setVoiceAvailable(false));
    return () => {
      live = false;
    };
  }, []);

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
  };

  const toggleFactor = (factor: string) => {
    setSelectedFactors((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  };

  // Handle voice transcribe
  const handleTranscribe = async () => {
    if (!recorder.recording) return;
    setTranscribing(true);
    try {
      const ext = extensionFor(recorder.recording.mimeType);
      const res = await voiceApi.transcribe(recorder.recording.blob, `checkin-voice.${ext}`);
      setExpression((prev) => (prev.trim() ? `${prev.trim()} ${res.text}` : res.text));
      recorder.reset();
      toast.success("Voice transcribed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't transcribe voice note.");
    } finally {
      setTranscribing(false);
    }
  };

  // Submit check-in to backend and request conversational reflection
  const handleSubmit = async () => {
    setSaving(true);
    const moodStr = (selectedEmotions.length > 0 ? selectedEmotions.join(", ") : "Unspecified").slice(0, 50);
    const focusStr = (selectedFactors.length > 0 ? selectedFactors.join(", ") : "General").slice(0, 100);
    const contextText = expression.trim() || null;

    try {
      // 1. Save check-in record preserving existing backend API
      await checkinsApi.create({
        mood: moodStr,
        focus_area: focusStr,
        context: contextText,
      });

      setStep(4);

      // 2. Transition into AI conversational reflection
      const prompt = `I just checked in with myself.
How I'm feeling: ${selectedEmotions.length > 0 ? selectedEmotions.join(", ") : "Not specified"}
Contributing factors: ${selectedFactors.length > 0 ? selectedFactors.join(", ") : "Not specified"}
${contextText ? `What's on my mind: "${contextText}"` : "I didn't add extra notes."}

Please offer a gentle, grounding, and empathetic 2-3 sentence reflection to help me process this moment.`;

      const chatRes = await chatApi.send(prompt, null);
      setReflection(chatRes.reply);
      setConvoId(chatRes.conversation_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't complete your check-in.");
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flow-container">
      {/* Gentle step indicator */}
      {step < 4 && (
        <div className="flow-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
          <span className={`flow-dot ${step >= 1 ? "is-active" : ""}`} />
          <span className={`flow-dot ${step >= 2 ? "is-active" : ""}`} />
          <span className={`flow-dot ${step >= 3 ? "is-active" : ""}`} />
        </div>
      )}

      {/* STEP 1: EMOTIONS */}
      {step === 1 && (
        <div className="flow-step stage" key="step-1">
          <header className="flow-head">
            <span className="eyebrow">Step 1 of 3</span>
            <h2>How are you feeling right now{userName ? `, ${userName}` : ""}?</h2>
            <p>Select any that resonate. There are no right or wrong answers.</p>
          </header>

          <div className="flow-chips">
            {EMOTIONS.map((emotion) => {
              const active = selectedEmotions.includes(emotion);
              return (
                <button
                  key={emotion}
                  type="button"
                  className="chip flow-chip"
                  aria-pressed={active}
                  onClick={() => toggleEmotion(emotion)}
                >
                  {emotion}
                </button>
              );
            })}
          </div>

          <div className="flow-footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSelectedEmotions([]);
                setStep(2);
              }}
            >
              Skip
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CONTEXT / CONTRIBUTING FACTORS */}
      {step === 2 && (
        <div className="flow-step stage" key="step-2">
          <header className="flow-head">
            <span className="eyebrow">Step 2 of 3</span>
            <h2>Do you know what's contributing to this?</h2>
            <p>Optional. Notice what areas of your life are taking up space today.</p>
          </header>

          <div className="flow-chips">
            {CONTEXT_FACTORS.map((factor) => {
              const active = selectedFactors.includes(factor);
              return (
                <button
                  key={factor}
                  type="button"
                  className="chip flow-chip"
                  aria-pressed={active}
                  onClick={() => toggleFactor(factor)}
                >
                  {factor}
                </button>
              );
            })}
          </div>

          <div className="flow-footer">
            <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setSelectedFactors([]);
                  setStep(3);
                }}
              >
                Skip
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: EXPRESSION (TEXT + VOICE) */}
      {step === 3 && (
        <div className="flow-step stage" key="step-3">
          <header className="flow-head">
            <span className="eyebrow">Step 3 of 3</span>
            <h2>What's on your mind?</h2>
            <p>Pour it out in your own words, or leave it blank if you prefer.</p>
          </header>

          <div className="flow-expression">
            <textarea
              className="textarea flow-textarea"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="Write or speak in English, Hindi, Hinglish... whatever feels natural."
              maxLength={4000}
              rows={5}
            />

            {/* Voice Recording Widget */}
            <div className="flow-voice-bar">
              {recorder.status === "recording" ? (
                <div className="flow-recording-live">
                  <span className="rec-dot" />
                  <span>Recording ({formatDuration(recorder.seconds)})</span>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => recorder.stop()}
                  >
                    Stop recording
                  </button>
                </div>
              ) : recorder.recording ? (
                <div className="flow-recorded-preview">
                  <span className="faint">Voice recorded ({formatDuration(recorder.recording.seconds)})</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      disabled={transcribing}
                      onClick={() => void handleTranscribe()}
                    >
                      {transcribing ? <Spinner label="Transcribing" /> : "Transcribe"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => recorder.reset()}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                voiceAvailable && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost flow-mic-btn"
                    onClick={() => void recorder.start()}
                  >
                    <Icon name="mic" size={16} /> Speak your thoughts
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flow-footer">
            <button type="button" className="btn btn--ghost" onClick={() => setStep(2)} disabled={saving}>
              Back
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? (
                <>
                  <Spinner label="Saving" /> Saving check-in…
                </>
              ) : (
                "Complete check-in"
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: AI REFLECTION */}
      {step === 4 && (
        <div className="flow-step stage" key="step-4">
          <div className="reflection-card">
            <div className="reflection-brand">
              <Mark size={40} motion={saving ? "think" : undefined} />
            </div>

            <header className="flow-head" style={{ textAlign: "center" }}>
              <span className="eyebrow">Elniv's Reflection</span>
              <h2>Thank you for checking in.</h2>
            </header>

            <div className="reflection-body">
              {reflection ? (
                <Markdown text={reflection} />
              ) : (
                <div className="reflection-loading">
                  <Spinner label="Reflecting" />
                  <p className="faint">Reflecting on what you shared…</p>
                </div>
              )}
            </div>

            {reflection && (
              <div className="reflection-actions">
                {convoId ? (
                  <Link to={`/chat/${convoId}`} className="btn btn--primary btn--block">
                    <Icon name="chat" size={18} /> Continue this in Chat
                  </Link>
                ) : (
                  <Link to="/chat" className="btn btn--primary btn--block">
                    <Icon name="chat" size={18} /> Talk with Elniv
                  </Link>
                )}
                <Link to="/home" className="btn btn--ghost btn--block">
                  Done for now
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
