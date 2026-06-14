import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps a list view in sync with the database without the user having to
 * leave and re-enter the screen.
 *
 * - Refetches when the tab/window regains focus or visibility.
 * - Polls every `intervalMs` (default 30s) while the tab is visible.
 * - Subscribes to Supabase Realtime `postgres_changes` for the given tables
 *   (works if the table is part of the `supabase_realtime` publication; if
 *   not, the focus + polling fallback still keeps the UI fresh).
 */
export function useAutoRefresh(
  reload: () => unknown | Promise<unknown>,
  tables: string[] = [],
  opts: { intervalMs?: number; enabled?: boolean } = {}
) {
  const { intervalMs = 30000, enabled = true } = opts;
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const safeReload = () => {
      if (cancelled) return;
      try {
        Promise.resolve(reloadRef.current()).catch(() => {});
      } catch {
        /* swallow */
      }
    };

    const onFocus = () => safeReload();
    const onVisibility = () => {
      if (document.visibilityState === "visible") safeReload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") safeReload();
    }, intervalMs);

    const channels = tables.map((t) =>
      supabase
        .channel(`auto-refresh:${t}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: t },
          () => safeReload()
        )
        .subscribe()
    );

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, tables.join("|")]);
}