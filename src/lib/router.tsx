import { useCallback, useSyncExternalStore } from "react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

const NAV_EVENT = "elniv:navigate";

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === window.location.pathname + window.location.search) return;
  if (options.replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  window.addEventListener(NAV_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(NAV_EVENT, callback);
  };
}

const getSnapshot = (): string => window.location.pathname + window.location.search;

export function useLocation(): { pathname: string; search: URLSearchParams } {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => "/");
  const index = value.indexOf("?");
  const pathname = index === -1 ? value : value.slice(0, index);
  const search = new URLSearchParams(index === -1 ? "" : value.slice(index + 1));
  return { pathname, search };
}

/** Match "/chat/:id" style patterns. Returns params or null. */
export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const clean = (value: string) => value.replace(/\/+$/, "") || "/";
  const patternParts = clean(pattern).split("/");
  const pathParts = clean(pathname).split("/");
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i] ?? "";
    const actual = pathParts[i] ?? "";
    if (expected.startsWith(":")) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  children?: ReactNode;
}

export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (rest.target && rest.target !== "_self") return;
      event.preventDefault();
      navigate(to, { replace });
    },
    [onClick, replace, rest.target, to],
  );
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
