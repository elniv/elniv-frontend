import { useState, useEffect } from "react";
import { Icon } from "../Icon";

export interface JournalEntry {
  id: string;
  prompt: string;
  content: string;
  date: string;
}

const STORAGE_KEY = "elniv_mindful_journal_entries";

const GENTLE_PROMPTS = [
  "What is one small thing that went okay today?",
  "Describe a moment you felt at peace recently.",
  "Write down one thing you are grateful for, no matter how small.",
  "What is something kind someone did for you, or you did for someone else?",
  "If you were speaking to a dear friend in your situation, what gentle words would you offer?",
  "What can you gently let go of control over today?",
  "What does your body or mind need right now at this exact moment?",
  "Notice something quiet or beautiful in the space around you right now.",
  "What is a heavy expectation you can give yourself permission to put down?",
];

export function MindfulJournal() {
  const [promptIndex, setPromptIndex] = useState(0);
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Load saved entries on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setEntries(JSON.parse(raw));
      }
    } catch {
      // storage unavailable
    }
  }, []);

  const currentPrompt = GENTLE_PROMPTS[promptIndex] ?? GENTLE_PROMPTS[0]!;

  const handleNextPrompt = () => {
    setPromptIndex((prev) => (prev + 1) % GENTLE_PROMPTS.length);
  };

  const handleSave = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const newEntry: JournalEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      prompt: currentPrompt,
      content: trimmed,
      date: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const nextEntries = [newEntry, ...entries];
    setEntries(nextEntries);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    } catch {
      // storage quota or disabled
    }

    setContent("");
    setSavedStatus("Saved quietly to your journal.");
    window.setTimeout(() => setSavedStatus(null), 3000);
  };

  const handleDeleteEntry = (id: string) => {
    const nextEntries = entries.filter((e) => e.id !== id);
    setEntries(nextEntries);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    } catch {
      // ignore
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="journal-container">
      <div className="journal-header">
        <h2 className="journal-title">Mindful Journal</h2>
        <p className="journal-subtitle">
          An unhurried, private writing space to untangle your thoughts.
        </p>
      </div>

      <div className="journal-pad">
        <div className="journal-prompt-card">
          <div className="journal-prompt-top">
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              Gentle Prompt
            </span>
            <button
              type="button"
              className="btn btn--sm btn--ghost journal-cycle-btn"
              onClick={handleNextPrompt}
              aria-label="Show next journaling prompt"
            >
              <Icon name="retry" size={14} />
              <span>Next prompt</span>
            </button>
          </div>
          <p className="journal-prompt-text">"{currentPrompt}"</p>
        </div>

        <div className="journal-textarea-wrapper">
          <textarea
            className="journal-textarea"
            placeholder="Let your thoughts flow freely here without self-judgment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
          />
        </div>

        <div className="journal-footer">
          <div className="journal-meta">
            <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
            {savedStatus && <span className="journal-saved-badge">{savedStatus}</span>}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {entries.length > 0 && (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => setShowHistory((prev) => !prev)}
              >
                <Icon name="book" size={16} />
                <span>{showHistory ? "Hide reflections" : `Past entries (${entries.length})`}</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!content.trim()}
              onClick={handleSave}
            >
              <Icon name="check" size={16} />
              <span>Save Entry</span>
            </button>
          </div>
        </div>
      </div>

      {showHistory && entries.length > 0 && (
        <div className="journal-history" aria-label="Past journal reflections">
          <h3 className="journal-history-title">Previous Reflections</h3>
          <div className="journal-history-list">
            {entries.map((entry) => (
              <div key={entry.id} className="journal-history-item">
                <div className="journal-history-item-top">
                  <span className="journal-history-date">{entry.date}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    aria-label="Delete entry"
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <div className="journal-history-prompt">"{entry.prompt}"</div>
                <p className="journal-history-content">{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
