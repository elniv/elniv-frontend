import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/Dialog";
import { ListSkeleton } from "../components/Skeleton";
import { Link } from "../lib/router";
import { checkinsApi } from "../lib/endpoints";
import { FOCUS_AREAS, MOODS, moodMeta, summarizeCheckins } from "../lib/moods";
import { dayLabel, timeLabel } from "../lib/format";
import { usePageMeta } from "../lib/hooks";
import { useToast } from "../lib/toast";
import type { Checkin } from "../lib/types";

function Trend({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const w = 300;
  const h = 72;
  const step = w / (scores.length - 1);
  const points = scores.map((s, i) => `${(i * step).toFixed(1)},${(h - 8 - ((s - 1) / 4) * (h - 16)).toFixed(1)}`);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Mood trend across your last ${scores.length} check-ins, from heavier to lighter`}>
      <polyline points={points.join(" ")} fill="none" stroke="var(--lav)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function CheckinsPage() {
  usePageMeta("Check-ins");
  const toast = useToast();
  const [items, setItems] = useState<Checkin[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Checkin | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await checkinsApi.list(50, 0);
      setItems(page.items);
      setTotal(page.total);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your check-ins.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mood || !focus) {
      setFormError("Choose how you're feeling and what's on your mind.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const created = await checkinsApi.create({ mood, focus_area: focus, context: context.trim() || null });
      setItems((current) => [created, ...current]);
      setTotal((t) => t + 1);
      setMood(null);
      setFocus(null);
      setContext("");
      toast.success("Check-in saved.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save your check-in.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await checkinsApi.remove(toDelete.id);
      setItems((current) => current.filter((c) => c.id !== toDelete.id));
      setTotal((t) => Math.max(0, t - 1));
      setToDelete(null);
      toast.success("Check-in deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that check-in.");
    } finally {
      setDeleting(false);
    }
  };

  const summary = useMemo(() => summarizeCheckins(items), [items]);
  const groups = useMemo(() => {
    const out: { label: string; entries: Checkin[] }[] = [];
    for (const entry of items) {
      const label = dayLabel(entry.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.entries.push(entry);
      else out.push({ label, entries: [entry] });
    }
    return out;
  }, [items]);

  const draftFor = (c: Checkin) =>
    `I checked in feeling ${c.mood.toLowerCase()}, and ${c.focus_area.toLowerCase()} is on my mind.${c.context ? ` ${c.context}` : ""} Can we talk about it?`;

  return (
    <div className="scroll-area">
      <div className="page">
        <header className="page__head">
          <h1>Check in</h1>
          <p>A minute to notice how you are. Your check-ins build a gentle picture over time, and you can bring any of them into a conversation.</p>
        </header>

        <form className="form section" onSubmit={submit} noValidate>
          <div className="field">
            <span className="label" id="mood-label">
              How are you feeling?
            </span>
            <div className="mood-grid" role="group" aria-labelledby="mood-label">
              {MOODS.map((m) => (
                <button key={m.label} type="button" className="mood" style={{ ["--c" as string]: m.color }} aria-pressed={mood === m.label} onClick={() => setMood(m.label)}>
                  <i />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label" id="focus-label">
              What's on your mind?
            </span>
            <div className="chips" role="group" aria-labelledby="focus-label">
              {FOCUS_AREAS.map((area) => (
                <button key={area} type="button" className="chip" aria-pressed={focus === area} onClick={() => setFocus(area)}>
                  {area}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="ctx">Anything you'd like to add? (optional)</label>
            <textarea id="ctx" className="textarea" value={context} maxLength={4000} onChange={(e) => setContext(e.target.value)} placeholder="A few words are plenty." />
          </div>
          {formError && (
            <p className="error-text" role="alert">
              {formError}
            </p>
          )}
          <div>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save check-in"}
            </button>
          </div>
        </form>

        <section className="section" aria-labelledby="history-h">
          <div className="section__head">
            <h2 id="history-h">Your check-ins</h2>
            {status === "ready" && total > 0 && <p>{total === 1 ? "1 check-in so far." : `${total} check-ins so far.`}</p>}
          </div>

          {status === "loading" && <ListSkeleton rows={5} label="Loading check-ins" />}
          {status === "error" && (
            <div className="notice notice--error" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn--sm" style={{ marginTop: 10 }} onClick={() => void load()}>
                <Icon name="retry" size={16} /> Try again
              </button>
            </div>
          )}
          {status === "ready" && items.length === 0 && <p className="muted">No check-ins yet. Your first one will show up here.</p>}

          {status === "ready" && items.length >= 2 && (
            <div style={{ display: "grid", gap: 10 }}>
              <Trend scores={summary.scores} />
              <p className="stat-line">
                {summary.topMood && (
                  <span>
                    Most common feeling lately: <strong>{summary.topMood}</strong>
                  </span>
                )}
                {summary.topFocus && (
                  <span>
                    Most on your mind: <strong>{summary.topFocus}</strong>
                  </span>
                )}
              </p>
            </div>
          )}

          {status === "ready" && (
            <div className="timeline">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="eyebrow day-label">{group.label}</div>
                  {group.entries.map((entry) => {
                    const meta = moodMeta(entry.mood);
                    return (
                      <article key={entry.id} className="entry">
                        <div className="entry__top">
                          <span className="entry__mood" style={{ ["--c" as string]: meta?.color }}>
                            <i />
                            {entry.mood}
                          </span>
                          <span className="faint">· {entry.focus_area}</span>
                          <time className="entry__time" dateTime={entry.created_at}>
                            {timeLabel(entry.created_at)}
                          </time>
                        </div>
                        {entry.context && <p className="entry__ctx">{entry.context}</p>}
                        <div className="entry__actions">
                          <Link to={`/chat?draft=${encodeURIComponent(draftFor(entry))}`} className="btn btn--sm btn--ghost">
                            <Icon name="chat" size={16} /> Talk about this
                          </Link>
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setToDelete(entry)} aria-label={`Delete ${entry.mood} check-in from ${dayLabel(entry.created_at)}`}>
                            <Icon name="trash" size={16} /> Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))}
              {items.length < total && (
                <div style={{ paddingTop: 12 }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={loadingMore}
                    onClick={async () => {
                      setLoadingMore(true);
                      try {
                        const page = await checkinsApi.list(50, items.length);
                        setItems((current) => [...current, ...page.items.filter((p) => !current.some((c) => c.id === p.id))]);
                        setTotal(page.total);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Couldn't load more.");
                      } finally {
                        setLoadingMore(false);
                      }
                    }}
                  >
                    {loadingMore ? "Loading…" : "Show older check-ins"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete this check-in?"
          body="It will be permanently removed from your history."
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
