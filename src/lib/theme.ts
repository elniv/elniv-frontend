import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
export type MotionPref = "system" | "reduced";

const THEME_KEY = "elniv.theme";
const MOTION_KEY = "elniv.motion";
const listeners = new Set<() => void>();

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

const prefersDark = (): boolean => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  return pref === "system" ? (prefersDark() ? "dark" : "light") : pref;
}

export function applyTheme(): void {
  const resolved = resolveTheme(read(THEME_KEY, ["system", "light", "dark"], "system"));
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0d1317" : "#f6f3ec");
  if (read(MOTION_KEY, ["system", "reduced"], "system") === "reduced") document.documentElement.dataset.motion = "reduced";
  else delete document.documentElement.dataset.motion;
}

function emit(): void {
  applyTheme();
  cached = null;
  listeners.forEach((l) => l());
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* ignore */
  }
  emit();
}

export function setMotionPref(pref: MotionPref): void {
  try {
    localStorage.setItem(MOTION_KEY, pref);
  } catch {
    /* ignore */
  }
  emit();
}

interface ThemeState {
  theme: ThemePref;
  motion: MotionPref;
}
let cached: ThemeState | null = null;

function snapshot(): ThemeState {
  if (!cached) cached = { theme: read(THEME_KEY, ["system", "light", "dark"], "system"), motion: read(MOTION_KEY, ["system", "reduced"], "system") };
  return cached;
}

export function initTheme(): void {
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", emit);
}

export function useTheme(): ThemeState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    snapshot,
  );
}
