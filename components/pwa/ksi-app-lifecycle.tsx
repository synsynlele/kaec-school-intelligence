"use client";

import { useEffect } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { invalidateKsiRuntimeAccess } from "@/lib/supabase/runtime-access";

const APP_RESUME_EVENT = "ksi:app-resume";
const MIN_BACKGROUND_MS = 15_000;

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/owner/access") ||
    pathname.startsWith("/teacher/join")
  );
}

export function KsiAppLifecycle() {
  useEffect(() => {
    let hiddenAt = document.visibilityState === "hidden" ? Date.now() : null;
    let recovery: Promise<void> | null = null;

    const recover = () => {
      if (recovery) return recovery;

      recovery = (async () => {
        invalidateKsiRuntimeAccess();

        const {
          data: { session },
          error,
        } = await getBrowserSupabaseClient().auth.getSession();

        if (!error && !session && !isPublicPath(window.location.pathname)) {
          window.location.replace("/auth/resolve");
          return;
        }

        window.dispatchEvent(new Event(APP_RESUME_EVENT));
      })()
        .catch(() => {
          // Let protected screens show their normal retry state instead of
          // treating a transient resume failure as missing school access.
          window.dispatchEvent(new Event(APP_RESUME_EVENT));
        })
        .finally(() => {
          recovery = null;
        });

      return recovery;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      const backgroundDuration = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (backgroundDuration >= MIN_BACKGROUND_MS) void recover();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void recover();
    };

    const handleOnline = () => void recover();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
