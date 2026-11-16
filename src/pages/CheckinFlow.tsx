import { useState, useRef, useEffect, useMemo } from "react";
import { Mark } from "../components/Logo";
import { Icon } from "../components/Icon";
import { AudioPlayer } from "../components/AudioPlayer";
import { Spinner } from "../components/Skeleton";
import { Markdown } from "../lib/markdown";
import { checkinsApi, chatApi, voiceApi } from "../lib/endpoints";
import { extensionFor, isRecordingSupported, useVoiceRecorder } from "../lib/voice";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { formatDuration } from "../lib/format";
import { navigate, Link } from "../lib/router";
import { useOnline, usePageMeta } from "../lib/hooks";
import type { VoiceStatus } from "../lib/types";

const EMOTIONAL_STATES = [
  { id: "calm", label: "Calm", desc: "Settled, peaceful" },
  { id: "happy", label: "Happy", desc: "Content, light" },
  { id: "anxious", label: "Anxious", desc: "Restless, worried" },
  { id: "overwhelmed", label: "Overwhelmed", desc: "Too much at once" },
  { id: "sad", label: "Sad", desc: "Heavy, down" },
  { id: "frustrated", label: "Frustrated", desc: "Stuck, irritated" },
  { id: "confused", label: "Confused", desc: "Unclear, mixed" },
  { id: "numb", label: "Numb", desc: "Detached, flat" },
  { id: "exhausted", label: "Exhausted", desc: "Drained, low energy" },
  { id: "not-sure", label: "Not sure", desc: "Hard to describe" },
];

const CONTRIBUTING_FACTORS = [
  "Work or study",
  "Relationships",
  "Uncertainty",
  "Health & body",
  "Sleep & fatigue",
  "Money & responsibilities",
  "A hard decision",
  "Something unexpected",
  "No clear reason",
];

const TIME_FRAMES = [
  "Just today",
  "Past few days",
  "Building for a while",
  "It comes and goes",
];

const PREFERENCES = [
  "I'd like to talk it through",
  "I simply want a quiet pause",
  "Just wanted to write it down",
];

export function CheckinFlowPage() {
  usePageMeta("Check-in · Elniv");
  const online = useOnline();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [contributing, setContributing] = useState<string[]>([]);
  const [timeFrame, setTimeFrame] = useState<string | null>(null);
  const [preference, setPreference] = useState<string | null>(null);
  const [expression, setExpression] = useState("");

  const [saving, setSaving] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  // Voice state
  const recorder = useVoiceRecorder();
  const [voice, setVoice] = useState<VoiceStatus | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const textField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    voiceApi
      .status()
      .then((s) => live && setVoice(s))
      .catch(() => live && setVoice({ available: false, provider: null }));
    return () => {
      live = false;
      stopSpeaking();
    };
  }, []);

  const toggleMood = (label: string) => {
    setSelectedMoods((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    );
  };

  const toggleFactor = (item: string) => {
    setContributing((prev) =>
      prev.includes(item) ? prev.filter((f) => f !== item) : [...prev, item]
    );
  };

  // Adaptive questions based on selected mood
  const isHeavy = useMemo(() => {
    return selectedMoods.some((m) =>
      ["Anxious", "Overwhelmed", "Sad", "Frustrated", "Numb", "Exhausted"].includes(m)
    );
  }, [selectedMoods]);

  const isPositive = useMemo(() => {
    return selectedMoods.some((m) => ["Calm", "Happy", "Hopeful", "Grateful"].includes(m));
  }, [selectedMoods]);

  // Voice recording handlers
  const startVoice = () => {
    setVoiceNote(null);
    if (!isRecordingSupported()) {
      setVoiceNote("Microphone is not supported in this browser. You can type freely instead.");
      return;
    }
    if (voice && !voice.available) {
      setVoiceNote("Voice transcription is not enabled on this server. You can type your expression.");
      return;
    }
    void recorder.start();
  };

  const transcribeRecording = async () => {
    const recording = recorder.recording;
    if (!recording || transcribing) return;
    setTranscribing(true);
    setVoiceNote(null);
    try {
      const res = await voiceApi.transcribe(recording.blob, `checkin-voice.${extensionFor(recording.mimeType)}`);
      setExpression((prev) => (prev.trim() ? `${prev.trim()} ${res.text}` : res.text).slice(0, 4000));
      recorder.reset();
      textField.current?.focus();
    } catch (e) {
      setVoiceNote(e instanceof Error ? e.message : "Couldn't transcribe recording.");
    } finally {
      setTranscribing(false);
    }
  };

  // Submit check-in and request intelligent reflection
  const finishCheckin = async () => {
    if (saving || reflecting) return;
    setError(null);
    setSaving(true);
    setReflecting(true);
    setStep(4);

    const moodString = selectedMoods.length > 0 ? selectedMoods.join(", ") : "Reflective";
    const focusString = contributing.length > 0
      ? contributing.join(", ")
      : preference ?? (timeFrame ?? "General check-in");

    // Persist check-in to database
    try {
      await checkinsApi.create({
        mood: moodString.slice(0, 50),
        focus_area: focusString.slice(0, 100),
        context: expression.trim() || (timeFrame ? `Timeline: ${timeFrame}` : null),
      });
    } catch {
      // Non-fatal if check-in logging has a transient network hitch, but notify
      console.warn("Check-in could not be stored in history.");
    } finally {
      setSaving(false);
    }

    // Build context message for AI
    const contextLines: string[] = [];
    contextLines.push(`[Check-in summary]`);
    contextLines.push(`Emotional state: ${selectedMoods.length > 0 ? selectedMoods.join(", ") : "Not specified / skipped"}`);
    if (contributing.length > 0) {
      contextLines.push(`Contributing factors: ${contributing.join(", ")}`);
    }
    if (timeFrame) {
      contextLines.push(`Timeline / duration: ${timeFrame}`);
    }
    if (preference) {
      contextLines.push(`User's current preference: ${preference}`);
    }
    if (expression.trim()) {
      contextLines.push(`User's personal expression:\n"${expression.trim()}"`);
    } else {
      contextLines.push(`(The user chose not to write additional text)`);
    }
    contextLines.push(`\nPlease provide a warm, concise, thoughtful reflection acknowledging what I shared. Offer genuine understanding without platitudes or diagnoses, and naturally suggest an appropriate next step.`);

    try {
      const response = await chatApi.send(contextLines.join("\n"), null);
      setAiResponse(response.reply);
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Elniv couldn't generate a reflection. You can still explore activities or start a conversation.");
    } finally {
      setReflecting(false);
    }
  };

  const handleSpeak = () => {
    if (!aiResponse) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speak(aiResponse, () => setSpeaking(false));
    }
  };

  return (
    <div className="checkin-flow">
      {/* Top Bar Navigation */}
      <div className="checkin-flow__top">
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={() => {
            if (step > 1 && step < 4) setStep((s) => (s - 1) as 1 | 2 | 3);
            else navigate("/home");
          }}
          aria-label={step > 1 && step < 4 ? "Previous step" : "Return home"}
        >
          <Icon name={step > 1 && step < 4 ? "back" : "x"} size={18} />
        </button>

        <div className="checkin-flow__indicators" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4}>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`checkin-flow__dot ${i === step ? "is-active" : ""} ${i < step ? "is-passed" : ""}`}
            />
          ))}
        </div>

        <Link to="/home" className="checkin-flow__exit" aria-label="Cancel and go home">
          Exit
        </Link>
      </div>

      <div className="checkin-flow__container">
        {/* STEP 1: How are you feeling right now? */}
        {step === 1 && (
          <div className="checkin-flow__step animate-fade-in">
            <header className="checkin-flow__header">
              <span className="eyebrow">Step 1 of 3</span>
              <h1>How are you feeling right now?</h1>
              <p className="muted">
                Select whatever resonates with you. You can choose more than one, or skip if it's hard to name.
              </p>
            </header>

            <div className="checkin-flow__mood-grid" role="group" aria-label="Emotional states">
              {EMOTIONAL_STATES.map((state) => {
                const active = selectedMoods.includes(state.label);
                return (
                  <button
                    key={state.id}
                    type="button"
                    className={`checkin-flow__mood-card ${active ? "is-selected" : ""}`}
                    aria-pressed={active}
                    onClick={() => toggleMood(state.label)}
                  >
                    <span className="checkin-flow__mood-title">{state.label}</span>
                    <span className="checkin-flow__mood-desc">{state.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="checkin-flow__nav">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  if (selectedMoods.length === 0) setSelectedMoods(["Not sure"]);
                  setStep(2);
                }}
              >
                Skip for now
              </button>

              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setStep(2)}
              >
                <span>Continue</span>
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Optional contextual questions */}
        {step === 2 && (
          <div className="checkin-flow__step animate-fade-in">
            <header className="checkin-flow__header">
              <span className="eyebrow">Step 2 of 3 · Context</span>
              <h1>
                {isHeavy
                  ? "What might be weighing on you?"
                  : isPositive
                  ? "What feels meaningful today?"
                  : "Would you like to add a little context?"}
              </h1>
              <p className="muted">
                These are entirely optional. Choose what fits, or pass to the next step.
              </p>
            </header>

            <div className="checkin-flow__questions">
              <section className="checkin-flow__q-group">
                <label className="label">Do you know what's contributing to this?</label>
                <div className="chips" role="group" aria-label="Contributing factors">
                  {CONTRIBUTING_FACTORS.map((factor) => {
                    const active = contributing.includes(factor);
                    return (
                      <button
                        key={factor}
                        type="button"
                        className="chip"
                        aria-pressed={active}
                        onClick={() => toggleFactor(factor)}
                      >
                        {factor}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="checkin-flow__q-group">
                <label className="label">Has this been with you for a while?</label>
                <div className="chips" role="radiogroup" aria-label="Timeframe">
                  {TIME_FRAMES.map((tf) => {
                    const active = timeFrame === tf;
                    return (
                      <button
                        key={tf}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className="chip"
                        onClick={() => setTimeFrame(active ? null : tf)}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="checkin-flow__q-group">
                <label className="label">What feels most helpful right now?</label>
                <div className="chips" role="radiogroup" aria-label="Preference">
                  {PREFERENCES.map((pref) => {
                    const active = preference === pref;
                    return (
                      <button
                        key={pref}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className="chip"
                        onClick={() => setPreference(active ? null : pref)}
                      >
                        {pref}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="checkin-flow__nav">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(3)}>
                Skip this step
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setStep(3)}>
                <span>Continue</span>
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Let the user express themselves */}
        {step === 3 && (
          <div className="checkin-flow__step animate-fade-in">
            <header className="checkin-flow__header">
              <span className="eyebrow">Step 3 of 3 · Self-Expression</span>
              <h1>Put whatever is on your mind into words.</h1>
              <p className="muted">
                There is no perfect way to say this. Feel free to write or speak in English, Hindi, Bengali, Hinglish, or whatever language comes naturally.
              </p>
            </header>

            <div className="checkin-flow__expression-box">
              {/* Voice Recorder Sub-section */}
              {recorder.status === "recording" || recorder.status === "recorded" ? (
                <div className="checkin-flow__voice-panel">
                  {recorder.status === "recorded" && recorder.recording ? (
                    <div className="recorder__stack" style={{ width: "100%" }}>
                      <AudioPlayer src={recorder.recording.url} seconds={recorder.recording.seconds} />
                      <div className="row" style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn--sm" onClick={recorder.reset} disabled={transcribing}>
                          Discard
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          onClick={() => void transcribeRecording()}
                          disabled={transcribing || !online}
                        >
                          {transcribing ? (
                            <>
                              <Spinner label="Transcribing" /> Transcribing…
                            </>
                          ) : (
                            "Convert to text"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="recorder" style={{ width: "100%" }}>
                      <button type="button" className="icon-btn" onClick={recorder.reset} aria-label="Cancel recording">
                        <Icon name="x" />
                      </button>
                      <div className="rec-bars" aria-hidden="true">
                        {recorder.levels.map((lvl, idx) => (
                          <i key={idx} style={{ height: `${Math.max(12, lvl * 100)}%` }} />
                        ))}
                      </div>
                      <span className="rec-time">{formatDuration(recorder.seconds)}</span>
                      <button type="button" className="send" onClick={recorder.stop} aria-label="Finish recording">
                        <Icon name="stop" size={18} />
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Text Expression Area */}
              <div className="checkin-flow__textarea-wrap">
                <textarea
                  ref={textField}
                  className="checkin-flow__textarea"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="Whatever is on your mind, you can put it into words here... (write or speak in any language)"
                  rows={5}
                  maxLength={4000}
                />

                <div className="checkin-flow__expression-tools">
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={startVoice}
                    disabled={recorder.status === "recording" || transcribing}
                    title="Record voice note"
                  >
                    <Icon name="mic" size={17} />
                    <span>Speak</span>
                  </button>
                  <span className="hint">{expression.length} / 4000</span>
                </div>
              </div>

              {voiceNote && <p className="error-text small" style={{ marginTop: 8 }}>{voiceNote}</p>}
            </div>

            <div className="checkin-flow__nav">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void finishCheckin()}
                disabled={saving || reflecting}
              >
                Skip expression
              </button>

              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void finishCheckin()}
                disabled={saving || reflecting}
              >
                <Icon name="spark" size={17} />
                <span>Reflect with Elniv</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Intelligent AI Response & Adaptive Next Steps */}
        {step === 4 && (
          <div className="checkin-flow__step checkin-flow__reflection animate-fade-in">
            {reflecting ? (
              <div className="checkin-flow__thinking" role="status">
                <Mark size={64} motion="think" />
                <h2>Listening and reflecting…</h2>
                <p className="muted">Elniv is taking in what you shared.</p>
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            ) : (
              <div className="checkin-flow__reflection-content">
                <header className="checkin-flow__reflection-head">
                  <div className="checkin-flow__mark-sm">
                    <Mark size={38} />
                  </div>
                  <div>
                    <span className="eyebrow">Elniv's Reflection</span>
                    <h2>A moment to pause</h2>
                  </div>
                </header>

                {error ? (
                  <div className="notice notice--error" style={{ marginBottom: 20 }}>
                    {error}
                  </div>
                ) : (
                  <div className="checkin-flow__reflection-body">
                    <Markdown text={aiResponse ?? ""} />
                    {canSpeak() && (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={handleSpeak}
                        style={{ marginTop: 12 }}
                        aria-pressed={speaking}
                      >
                        <Icon name={speaking ? "stop" : "volume"} size={16} />
                        <span>{speaking ? "Stop reading" : "Read aloud"}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Adaptive Options depending on user situation */}
                <div className="checkin-flow__adaptive-block">
                  <p className="label" style={{ marginBottom: 12 }}>What would help you right now?</p>

                  <div className="checkin-flow__actions-grid">
                    {/* If user feels overwhelmed or distressed: highlight calming activities */}
                    {isHeavy ? (
                      <>
                        <Link to="/activities?tool=grounding" className="checkin-flow__action-card is-prominent">
                          <div className="checkin-flow__action-icon">
                            <Icon name="feather" size={20} />
                          </div>
                          <div>
                            <strong>5-4-3-2-1 Grounding</strong>
                            <p>Settle your senses and return to the present room.</p>
                          </div>
                        </Link>

                        <Link to="/activities?tool=breathing" className="checkin-flow__action-card">
                          <div className="checkin-flow__action-icon">
                            <Icon name="wind" size={20} />
                          </div>
                          <div>
                            <strong>Gentle Breathing</strong>
                            <p>A short, unhurried breath pause with visual guidance.</p>
                          </div>
                        </Link>

                        {conversationId && (
                          <Link to={`/chat/${conversationId}`} className="checkin-flow__action-card">
                            <div className="checkin-flow__action-icon">
                              <Icon name="chat" size={20} />
                            </div>
                            <div>
                              <strong>Talk it out with Elniv</strong>
                              <p>Keep untangling your thoughts in conversation.</p>
                            </div>
                          </Link>
                        )}
                      </>
                    ) : isPositive ? (
                      <>
                        <Link to="/home" className="checkin-flow__action-card is-prominent">
                          <div className="checkin-flow__action-icon">
                            <Icon name="check" size={20} />
                          </div>
                          <div>
                            <strong>Continue with your day</strong>
                            <p>Carry this gentle clarity into whatever is next.</p>
                          </div>
                        </Link>

                        {conversationId && (
                          <Link to={`/chat/${conversationId}`} className="checkin-flow__action-card">
                            <div className="checkin-flow__action-icon">
                              <Icon name="chat" size={20} />
                            </div>
                            <div>
                              <strong>Explore in conversation</strong>
                              <p>Dive deeper into what's going well or on your mind.</p>
                            </div>
                          </Link>
                        )}

                        <Link to="/activities?tool=mindful" className="checkin-flow__action-card">
                          <div className="checkin-flow__action-icon">
                            <Icon name="spark" size={20} />
                          </div>
                          <div>
                            <strong>Mindful reflection</strong>
                            <p>Anchor this positive feeling with a quiet prompt.</p>
                          </div>
                        </Link>
                      </>
                    ) : (
                      <>
                        {conversationId ? (
                          <Link to={`/chat/${conversationId}`} className="checkin-flow__action-card is-prominent">
                            <div className="checkin-flow__action-icon">
                              <Icon name="chat" size={20} />
                            </div>
                            <div>
                              <strong>Explore with Elniv</strong>
                              <p>Continue this thread into a guided conversation.</p>
                            </div>
                          </Link>
                        ) : (
                          <Link to="/chat" className="checkin-flow__action-card is-prominent">
                            <div className="checkin-flow__action-icon">
                              <Icon name="chat" size={20} />
                            </div>
                            <div>
                              <strong>Talk with Elniv</strong>
                              <p>Begin a conversation at your own pace.</p>
                            </div>
                          </Link>
                        )}

                        <Link to="/activities" className="checkin-flow__action-card">
                          <div className="checkin-flow__action-icon">
                            <Icon name="wind" size={20} />
                          </div>
                          <div>
                            <strong>Reset Space & Activities</strong>
                            <p>Breathing, grounding exercises, or meditative mini-games.</p>
                          </div>
                        </Link>

                        <Link to="/home" className="checkin-flow__action-card">
                          <div className="checkin-flow__action-icon">
                            <Icon name="home" size={20} />
                          </div>
                          <div>
                            <strong>Return home</strong>
                            <p>Your check-in is saved in your reflections history.</p>
                          </div>
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                <div className="checkin-flow__foot-nav">
                  <Link to="/home" className="btn btn--ghost">
                    Done for now
                  </Link>
                  <Link to="/checkins" className="btn btn--sm btn--ghost muted">
                    View check-in history
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
