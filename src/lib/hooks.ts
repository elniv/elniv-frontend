import { useEffect, useSyncExternalStore } from "react";
import { BRAND } from "./brand";
import { getSession, subscribeSession } from "./auth";
import type { Session } from "./auth";

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export const useOnline = (): boolean =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

export const useSession = (): Session | null => useSyncExternalStore(subscribeSession, getSession, () => null);

/** Set the document title and whether search engines should index this page. */
export function usePageMeta(title: string | null, options: { index?: boolean } = {}): void {
  const index = options.index ?? false;
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : `${BRAND.name}: ${BRAND.tagline.replace(/\.$/, "").toLowerCase()}`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = index ? "index,follow" : "noindex,nofollow";
  }, [title, index]);
}

/** Prevent the page behind a drawer or dialog from scrolling. */
export function useBodyLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}
