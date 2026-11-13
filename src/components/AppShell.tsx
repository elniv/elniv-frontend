import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Brand } from "./Logo";
import { Icon } from "./Icon";
import { ConfirmDialog } from "./Dialog";
import { ListSkeleton } from "./Skeleton";
import { Link, matchRoute, navigate, useLocation } from "../lib/router";
import { useConversations } from "../lib/conversations";
import { useOnline, useSession, useBodyLock } from "../lib/hooks";
import { displayName, signOut } from "../lib/auth";
import { resolveTheme, setThemePref, useTheme } from "../lib/theme";
import { useToast } from "../lib/toast";
import type { Conversation } from "../lib/types";

function ConversationRow({ convo, active, onNavigate }: { convo: Conversation; active: boolean; onNavigate: () => void }) {
  const { rename, remove } = useConversations();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(convo.title);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = title.trim();
    if (!next || next === convo.title) {
      setEditing(false);
      setTitle(convo.title);
      return;
    }
    try {
      await rename(convo.id, next);
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename the conversation.");
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await remove(convo.id);
      setConfirming(false);
      toast.success("Conversation deleted.");
      if (active) navigate("/chat", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the conversation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="convo" data-active={active}>
      {editing ? (
        <form onSubmit={submit} style={{ display: "contents" }}>
          <input
            ref={input}
            className="input convo__rename"
            value={title}
            maxLength={255}
            aria-label="Conversation title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setTitle(convo.title);
              }
            }}
            onBlur={() => void submit(new Event("submit") as unknown as FormEvent)}
          />
        </form>
      ) : (
        <>
          <Link to={`/chat/${convo.id}`} className="convo__link" onClick={onNavigate} aria-current={active ? "page" : undefined} title={convo.title}>
            {convo.title}
          </Link>
          <div className="convo__actions">
            <button type="button" className="icon-btn icon-btn--sm" aria-label={`Rename ${convo.title}`} onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} />
            </button>
            <button type="button" className="icon-btn icon-btn--sm" aria-label={`Delete ${convo.title}`} onClick={() => setConfirming(true)}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        </>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete this conversation?"
          body="The conversation and all of its messages will be permanently deleted. This can't be undone."
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const session = useSession();
  const online = useOnline();
  const toast = useToast();
  const { items, total, status, error, refresh, loadMore } = useConversations();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const rail = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activeId = matchRoute("/chat/:id", pathname)?.id ?? null;
  const isMobileDrawer = open;
  useBodyLock(isMobileDrawer && window.matchMedia("(max-width: 899px)").matches);

  // Close the drawer on navigation and with Escape; return focus to the menu button.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    rail.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const user = session?.user;
  const toggleTheme = () => setThemePref(resolveTheme(theme) === "dark" ? "light" : "dark");
  const dark = resolveTheme(theme) === "dark";

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside ref={rail} className={`rail ${open ? "is-open" : ""}`} aria-label="Elniv navigation">
        <div className="rail__top">
          <Brand to="/chat" />
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu" style={{ display: open ? "grid" : "none" }}>
            <Icon name="x" />
          </button>
        </div>
        <Link to="/chat" className="btn btn--primary btn--block" onClick={() => setOpen(false)}>
          <Icon name="plus" size={18} /> New conversation
        </Link>
        <nav className="nav" aria-label="Sections" style={{ marginTop: 12 }}>
          <Link to="/chat" aria-current={pathname.startsWith("/chat") ? "page" : undefined}>
            <Icon name="chat" size={18} /> Conversations
          </Link>
          <Link to="/checkins" aria-current={pathname === "/checkins" ? "page" : undefined}>
            <Icon name="pulse" size={18} /> Check-ins
          </Link>
          <Link to="/settings" aria-current={pathname === "/settings" ? "page" : undefined}>
            <Icon name="settings" size={18} /> Settings
          </Link>
        </nav>
        <div className="eyebrow rail__label">Recent</div>
        <div className="rail__list">
          {status === "loading" && <ListSkeleton rows={5} label="Loading conversations" />}
          {status === "error" && (
            <div className="notice notice--error small" role="alert">
              {error ?? "Couldn't load conversations."}{" "}
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {status === "ready" && items.length === 0 && <p className="small faint" style={{ padding: "4px 12px" }}>Your conversations will appear here.</p>}
          {items.map((convo) => (
            <ConversationRow key={convo.id} convo={convo} active={convo.id === activeId} onNavigate={() => setOpen(false)} />
          ))}
          {status === "ready" && items.length < total && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                try {
                  await loadMore();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't load more.");
                } finally {
                  setLoadingMore(false);
                }
              }}
            >
              {loadingMore ? "Loading…" : "Show older"}
            </button>
          )}
        </div>
        <div className="rail__foot">
          <div className="rail__user">
            <strong>{displayName(user)}</strong>
            <span>{user?.email}</span>
          </div>
          <button type="button" className="icon-btn icon-btn--sm" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
            <Icon name={dark ? "sun" : "moon"} size={18} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              navigate("/", { replace: true });
            }}
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>
      <div className={`scrim ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="main">
        <header className="topbar">
          <button ref={menuButton} type="button" className="icon-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <Brand to="/chat" />
          <Link to="/chat" className="icon-btn" aria-label="New conversation">
            <Icon name="plus" />
          </Link>
        </header>
        {!online && (
          <div className="offline-banner" role="status">
            You're offline. Elniv will reconnect when your connection returns.
          </div>
        )}
        <main id="main" tabIndex={-1} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
