import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { conversationsApi } from "./endpoints";
import type { Conversation } from "./types";

interface ConversationsState {
  items: Conversation[];
  total: number;
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
}

const Ctx = createContext<ConversationsState | null>(null);

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<ConversationsState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await conversationsApi.list(100, 0);
      setItems(page.items);
      setTotal(page.total);
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus((s) => (s === "ready" ? s : "error"));
      setError(e instanceof Error ? e.message : "Couldn't load conversations.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    const page = await conversationsApi.list(100, items.length);
    setItems((current) => [...current, ...page.items.filter((p) => !current.some((c) => c.id === p.id))]);
    setTotal(page.total);
  }, [items.length]);

  const rename = useCallback(async (id: string, title: string) => {
    const updated = await conversationsApi.rename(id, title);
    setItems((current) => current.map((c) => (c.id === id ? updated : c)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await conversationsApi.remove(id);
    setItems((current) => current.filter((c) => c.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  const removeAll = useCallback(async () => {
    // Collect every id first (the list is paginated), then delete them.
    const ids: string[] = [];
    for (;;) {
      const page = await conversationsApi.list(100, ids.length);
      ids.push(...page.items.map((c) => c.id));
      if (page.items.length === 0 || ids.length >= page.total) break;
    }
    for (const id of ids) await conversationsApi.remove(id);
    setItems([]);
    setTotal(0);
  }, []);

  const value = useMemo(
    () => ({ items, total, status, error, refresh, loadMore, rename, remove, removeAll }),
    [items, total, status, error, refresh, loadMore, rename, remove, removeAll],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConversations(): ConversationsState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useConversations must be used inside ConversationsProvider");
  return value;
}
