"use client";
/**
 * CoverProvider — applies the selected "cover" skin at runtime and exposes it to
 * the tree via context. The choice is stored per-device in localStorage (the
 * cover is what THIS device shows; it is intentionally not tied to the encrypted
 * account, so it works before sign-in and offline).
 *
 * The stored choice is read via useSyncExternalStore so the server/first-paint
 * render uses the default (no hydration mismatch) and changes in another tab are
 * picked up. To avoid a theme flash, an inline script in the root layout sets the
 * `data-cover` attribute synchronously before paint; this provider then keeps the
 * attribute, document title, and <meta theme-color> in sync.
 */
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  COVERS,
  DEFAULT_COVER_ID,
  COVER_STORAGE_KEY,
  getCover,
  coverTitle,
  type Cover,
} from "@/lib/covers";

interface CoverContextValue {
  cover: Cover;
  setCover: (id: string) => void;
  covers: Cover[];
}

const CoverContext = createContext<CoverContextValue | null>(null);

// ─── External store (localStorage + same-tab notifications) ───────────────────
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COVER_STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function readStoredId(): string {
  try {
    return localStorage.getItem(COVER_STORAGE_KEY) ?? DEFAULT_COVER_ID;
  } catch {
    return DEFAULT_COVER_ID;
  }
}

function writeStoredId(id: string): void {
  try {
    localStorage.setItem(COVER_STORAGE_KEY, id);
  } catch {
    /* ignore persistence failure */
  }
  listeners.forEach((l) => l());
}

function applyCover(cover: Cover): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-cover", cover.id);
  document.title = coverTitle(cover);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", cover.themeColor);
}

export default function CoverProvider({ children }: { children: React.ReactNode }) {
  // Server snapshot is the default → server HTML and first client render agree.
  const id = useSyncExternalStore(subscribe, readStoredId, () => DEFAULT_COVER_ID);
  const cover = getCover(id);

  // DOM side effects only (no setState) — re-apply when the resolved cover changes.
  useEffect(() => {
    applyCover(cover);
  }, [cover]);

  const setCover = useCallback((next: string) => writeStoredId(getCover(next).id), []);

  return (
    <CoverContext.Provider value={{ cover, setCover, covers: COVERS }}>
      {children}
    </CoverContext.Provider>
  );
}

/** Access the active cover. Falls back to the default if used outside a provider. */
export function useCover(): CoverContextValue {
  const ctx = useContext(CoverContext);
  if (ctx) return ctx;
  return { cover: getCover(DEFAULT_COVER_ID), setCover: () => {}, covers: COVERS };
}
