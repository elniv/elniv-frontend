import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Mark } from "../components/Logo";
import { Icon } from "../components/Icon";
import { AudioPlayer } from "../components/AudioPlayer";
import { Skeleton, Spinner } from "../components/Skeleton";
import { Markdown } from "../lib/markdown";
import { chatApi, loadAllMessages, voiceApi } from "../lib/endpoints";
import { ApiError, isAbort } from "../lib/api";
import { useConversations } from "../lib/conversations";
import { navigate, useLocation, matchRoute, Link } from "../lib/router";
import { useOnline, usePageMeta, useSession } from "../lib/hooks";
import { displayName } from "../lib/auth";
import { formatDuration, greeting, timeLabel } from "../lib/format";
import { extensionFor, isRecordingSupported, MAX_RECORDING_SECONDS, useVoiceRecorder } from "../lib/voice";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { useToast } from "../lib/toast";
import type { VoiceStatus } from "../lib/types";

const MAX_LENGTH = 4000;

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  failed?: boolean;
  error?: string;
}

const STARTERS: Record<string, string[]> = {
  default: ["I've had a lot on my mind and I'm not sure where to start.", "Help me think through a decision I'm stuck on.", "I just need to get something off my chest."],
  stress: ["Everything feels like too much right now.", "Help me untangle what's making me stressed.", "I can't switch my thoughts off."],
  decision: ["I'm torn between two options and need to think it through.", "Help me work out what I actually want.", "I keep going back and forth on a decision."],
  feelings: ["I want to understand why I feel the way I do.", "Something has been bothering me and I can't name it.", "I'd like to talk about how today went."],
  growth: ["I want to build a healthier habit and keep failing.", "Help me figure out what I want from this year.", "I'd like to reflect on a pattern I keep repeating."],
};

let localId = 0;
const nextLocalId = (): string => `local-${Date.now()}-${localId++}`;

export function ChatPage() {
  const { pathname, search } = useLocation();
  const routeId = matchRoute("/chat/:id", pathname)?.id ?? null;
  const session = useSession();
  const online = useOnline();
  const toast = useToast();
  const { refresh, items: conversations } = useConversations();

  const [conversationId, setConversationId] = useState<string | null>(routeId);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(routeId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [draft, setDraft] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceStatus | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const adopted = useRef<string | null>(null); // conversation id created by this view, whose messages are already local
  const sendAbort = useRef<AbortController | null>(null);
  const recorder = useVoiceRecorder();

  const title = conversations.find((c) => c.id === conversationId)?.title ?? null;
  usePageMeta(title ?? "Talk with Elniv");

  // Pre-fill the composer from a link such as /chat?draft=… (used by check-ins).
  useEffect(() => {
    const incoming = search.get("draft");
    if (incoming) {
      setDraft(incoming.slice(0, MAX_LENGTH));
      history.replaceState(null, "", pathname);
      field.current?.focus();
    }
  }, [pathname, search]);

  // Load history when the route points at a conversation we don't already hold.
  useEffect(() => {
    if (routeId === null) {
      adopted.current = null;
      setConversationId(null);
      setMessages([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    if (adopted.current === routeId) return;
    const controller = new AbortController();
    setConversationId(routeId);
    setMessages([]);
    setLoading(true);
    setLoadError(null);
    loadAllMessages(routeId, controller.signal)
      .then((list) => {
        setMessages(list.map((m) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })));
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setLoadError(error instanceof ApiError && error.status === 404 ? "That conversation doesn't exist, or it was deleted." : error instanceof Error ? error.message : "Couldn't load this conversation.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [routeId]);

  useEffect(
    () => () => {
      sendAbort.current?.abort();
      stopSpeaking();
    },
    [],
  );

  // Voice availability comes from the backend (a transcription key must be configured).
  useEffect(() => {
    let live = true;
    voiceApi
      .status()
      .then((s) => live && setVoice(s))
      .catch(() => live && setVoice({ available: false, provider: null }));
    return () => {
      live = false;
    };
  }, []);

  // Keep the newest message in view unless the reader has scrolled up.
  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useLayoutEffect(() => {
    if (atBottom || waiting) scrollToBottom(!loading);
  }, [messages, waiting, loading, atBottom, scrollToBottom]);

  // Grow the textarea with its content.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 152)}px`;
  }, [draft]);

  const send = useCallback(
    async (text: string, retryOf?: string) => {
      const content = text.trim();
      if (!content || waiting) return;
      if (content.length > MAX_LENGTH) {
        toast.error(`Messages can be up to ${MAX_LENGTH.toLocaleString()} characters.`);
        return;
      }
      stopSpeaking();
      setSpeakingId(null);
      const id = retryOf ?? nextLocalId();
      const userMessage: UiMessage = { id, role: "user", content, created_at: new Date().toISOString() };
      setMessages((current) => (retryOf ? current.map((m) => (m.id === retryOf ? { ...userMessage, created_at: m.created_at } : m)) : [...current, userMessage]));
      if (!retryOf) setDraft("");
      setAtBottom(true);
      setWaiting(true);

      const controller = new AbortController();
      sendAbort.current = controller;
      try {
        const reply = await chatApi.send(content, conversationId, controller.signal);
        setMessages((current) => [...current, { id: nextLocalId(), role: "assistant", content: reply.reply, created_at: new Date().toISOString() }]);
        if (reply.conversation_id && reply.conversation_id !== conversationId) {
          adopted.current = reply.conversation_id;
          setConversationId(reply.conversation_id);
          navigate(`/chat/${reply.conversation_id}`, { replace: true });
        }
        void refresh();
      } catch (error) {
        if (isAbort(error)) return;
        const message = error instanceof Error ? error.message : "That message didn't go through.";
        setMessages((current) => current.map((m) => (m.id === id ? { ...m, failed: true, error: message } : m)));
      } finally {
        setWaiting(false);
        sendAbort.current = null;
      }
    },
    [conversationId, refresh, toast, waiting],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  };

  const onScroll = () => {
    const el = scroller.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const readAloud = (message: UiMessage) => {
    if (speakingId === message.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(message.id);
    speak(message.content, () => setSpeakingId((current) => (current === message.id ? null : current)));
  };

  const copy = async (message: UiMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  };

  // ── Voice ──
  const startVoice = () => {
    setVoiceNote(null);
    if (!isRecordingSupported()) {
      setVoiceNote("Your browser can't record audio. You can type instead, or try a recent version of Chrome, Edge, Firefox or Safari.");
      return;
    }
    if (voice && !voice.available) {
      setVoiceNote("Voice messages need speech-to-text to be set up on this Elniv server. Typing works as normal.");
      return;
    }
    void recorder.start();
  };

  const useRecording = async () => {
    const recording = recorder.recording;
    if (!recording || transcribing) return;
    setTranscribing(true);
    setVoiceNote(null);
    try {
      const result = await voiceApi.transcribe(recording.blob, `voice-message.${extensionFor(recording.mimeType)}`);
      setDraft((current) => (current.trim() ? `${current.trim()} ${result.text}` : result.text).slice(0, MAX_LENGTH));
      recorder.reset();
      field.current?.focus();
    } catch (error) {
      setVoiceNote(error instanceof Error ? error.message : "That recording couldn't be transcribed.");
    } finally {
      setTranscribing(false);
    }
  };

  const recorderError =
    recorder.error === "denied"
      ? "Microphone access is blocked. Allow it in your browser's site settings, then try again."
      : recorder.error === "no-device"
        ? "No microphone was found. Connect one and try again."
        : recorder.error === "failed"
          ? "Recording didn't work on this device. You can type instead."
          : null;

  const name = displayName(session?.user);
  const intent = typeof session?.user.user_metadata?.intent === "string" ? (session.user.user_metadata.intent as string) : "default";
  const starters = useMemo(() => STARTERS[intent] ?? STARTERS.default ?? [], [intent]);
  const empty = !loading && !loadError && messages.length === 0;
  const recordingActive = recorder.status === "requesting" || recorder.status === "recording" || recorder.status === "recorded";
  const overLimit = draft.length > MAX_LENGTH;
  const canSend = draft.trim().length > 0 && !overLimit && !waiting && online;

  return (
    <div className="chat">
      <div className="chat__scroll" ref={scroller} onScroll={onScroll}>
        <div className="chat__col" aria-live="polite" aria-relevant="additions" aria-busy={loading || waiting}>
          {loading && (
            <div role="status" aria-label="Loading conversation" style={{ display: "grid", gap: 22 }}>
              <Skeleton height={44} width="55%" />
              <Skeleton height={90} width="85%" />
              <Skeleton height={44} width="40%" />
            </div>
          )}

          {loadError && (
            <div className="empty">
              <Mark size={64} />
              <h2>Can't open this conversation</h2>
              <p>{loadError}</p>
              <div className="row">
                <button type="button" className="btn" onClick={() => window.location.reload()}>
                  <Icon name="retry" size={18} /> Try again
                </button>
                <button type="button" className="btn btn--primary" onClick={() => navigate("/chat")}>
                  Start a new one
                </button>
              </div>
            </div>
          )}

          {empty && (
            <div className="empty">
              <Mark size={84} motion="float" />
              <h1>{greeting(name)}</h1>
              <p>This is a quiet space. Say whatever is on your mind, in your own words, at your own pace.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", margin: "16px 0 8px" }}>
                <Link to="/checkin" className="btn btn--primary btn--sm">
                  <Icon name="spark" size={16} /> Start a check-in instead
                </Link>
                <Link to="/activities" className="btn btn--ghost btn--sm">
                  <Icon name="wind" size={16} /> Activities & Reset
                </Link>
              </div>
              <div className="starters">
                {starters.map((text) => (
                  <button
                    key={text}
                    type="button"
                    className="starter"
                    onClick={() => {
                      setDraft(text);
                      field.current?.focus();
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const isAsst = message.role === "assistant";
            const hasGrounding = isAsst && /grounding|5-4-3-2-1/i.test(message.content);
            const hasBreathing = isAsst && /breathing|breath pause/i.test(message.content);
            const hasReset = isAsst && /reset space|activities|calm reset/i.test(message.content);
            const hasCrisis = isAsst && /suicide|self-harm|harming myself|crisis line|helpline|emergency number/i.test(message.content);

            return message.role === "user" ? (
              <div key={message.id} className={`msg msg--user ${message.failed ? "msg--failed" : ""}`}>
                <div className="msg__bubble">{message.content}</div>
                {message.failed && (
                  <div className="msg__error" role="alert">
                    <span>{message.error ?? "This message didn't send."}</span>
                    <button type="button" className="btn btn--sm" onClick={() => void send(message.content, message.id)} disabled={waiting}>
                      <Icon name="retry" size={16} /> Retry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div key={message.id} className="msg">
                <div className="msg__assistant">
                  <Mark size={30} />
                  <div className="msg__body">
                    <Markdown text={message.content} />

                    {hasCrisis && (
                      <div className="notice notice--lav" style={{ marginTop: 12, fontSize: "0.875rem" }}>
                        <strong>Need immediate, confidential support?</strong>
                        <p style={{ margin: "4px 0" }}>If you or someone you know is going through a crisis, please connect with someone who can support you right now:</p>
                        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                          <li><strong>US & Canada:</strong> Call or text <strong>988</strong></li>
                          <li><strong>India:</strong> KIRAN Helpline <strong>1800-599-0019</strong> or Vandrevala Foundation</li>
                          <li><strong>UK:</strong> Call <strong>111</strong> or <strong>999</strong></li>
                          <li><strong>Worldwide:</strong> <a href="https://www.befrienders.org" target="_blank" rel="noopener noreferrer">Befrienders Worldwide</a></li>
                        </ul>
                      </div>
                    )}

                    {(hasGrounding || hasBreathing || hasReset) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                        {hasGrounding && (
                          <Link to="/activities?tool=grounding" className="btn btn--sm btn--ghost" style={{ background: "var(--surface-2)", fontSize: "0.8125rem" }}>
                            <Icon name="feather" size={14} /> Try 5-4-3-2-1 Grounding
                          </Link>
                        )}
                        {hasBreathing && (
                          <Link to="/activities?tool=breathing" className="btn btn--sm btn--ghost" style={{ background: "var(--surface-2)", fontSize: "0.8125rem" }}>
                            <Icon name="wind" size={14} /> Gentle Breathing Pause
                          </Link>
                        )}
                        {hasReset && (
                          <Link to="/activities" className="btn btn--sm btn--ghost" style={{ background: "var(--surface-2)", fontSize: "0.8125rem" }}>
                            <Icon name="spark" size={14} /> Open Reset Space
                          </Link>
                        )}
                      </div>
                    )}

                    <div className="msg__meta">
                      <span>{timeLabel(message.created_at)}</span>
                      <button type="button" className="icon-btn icon-btn--sm" aria-label="Copy reply" onClick={() => void copy(message)}>
                        <Icon name="copy" size={16} />
                      </button>
                      {canSpeak() && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          aria-label={speakingId === message.id ? "Stop reading aloud" : "Read reply aloud"}
                          aria-pressed={speakingId === message.id}
                          onClick={() => readAloud(message)}
                        >
                          <Icon name={speakingId === message.id ? "stop" : "volume"} size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {waiting && (
            <div className="thinking" role="status">
              <Mark size={30} motion="think" />
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="sr-only">Elniv is thinking</span>
            </div>
          )}
        </div>
      </div>

      {!atBottom && messages.length > 0 && (
        <button type="button" className="icon-btn jump" onClick={() => scrollToBottom(true)} aria-label="Jump to latest message">
          <Icon name="down" />
        </button>
      )}

      <div className="composer-wrap">
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          {recordingActive ? (
            recorder.status === "recorded" && recorder.recording ? (
              <div className="recorder__stack">
                <AudioPlayer src={recorder.recording.url} seconds={recorder.recording.seconds} />
                <div className="row">
                  <button type="button" className="btn btn--sm" onClick={recorder.reset} disabled={transcribing}>
                    Discard
                  </button>
                  <button type="button" className="btn btn--sm btn--primary" onClick={() => void useRecording()} disabled={transcribing || !online}>
                    {transcribing ? (
                      <>
                        <Spinner label="Transcribing" /> Transcribing…
                      </>
                    ) : (
                      "Transcribe to message"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="recorder" role="group" aria-label="Voice recording">
                <button type="button" className="icon-btn" onClick={recorder.reset} aria-label="Cancel recording">
                  <Icon name="x" />
                </button>
                {recorder.status === "requesting" ? (
                  <span className="muted small" role="status">
                    Waiting for microphone permission…
                  </span>
                ) : (
                  <div className="rec-bars" aria-hidden="true">
                    {recorder.levels.map((level, i) => (
                      <i key={i} style={{ height: `${Math.max(10, level * 100)}%` }} />
                    ))}
                  </div>
                )}
                <div className="row" style={{ gap: 8 }}>
                  {recorder.status === "recording" && (
                    <>
                      <span className="rec-dot" aria-hidden="true" />
                      <span className="rec-time" role="timer" aria-label="Recording length">
                        {formatDuration(recorder.seconds)}
                      </span>
                    </>
                  )}
                  <button type="button" className="send" onClick={recorder.stop} aria-label="Stop recording" disabled={recorder.status !== "recording"}>
                    <Icon name="stop" size={18} />
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="composer__box">
              <textarea
                ref={field}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Write whatever is on your mind… (English, Hindi, Bengali, Hinglish…)"
                aria-label="Message"
                enterKeyHint="send"
                autoComplete="off"
                spellCheck
              />
              <div className="composer__actions">
                <button type="button" className="icon-btn" onClick={startVoice} aria-label="Record a voice message" title="Record a voice message">
                  <Icon name="mic" />
                </button>
                <button type="submit" className="send" aria-label="Send message" disabled={!canSend}>
                  <Icon name="send" size={20} />
                </button>
              </div>
            </div>
          )}
          <div className="composer__foot" aria-live="polite">
            <span className={voiceNote || recorderError ? "error-text" : ""}>
              {recorderError ??
                voiceNote ??
                (recorder.status === "recording" ? `Recording, up to ${formatDuration(MAX_RECORDING_SECONDS)}. Your voice is transcribed, not stored.` : "Enter to send · Shift+Enter for a new line")}
            </span>
            {draft.length > MAX_LENGTH - 500 && (
              <span className={overLimit ? "counter--warn" : ""}>
                {draft.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
