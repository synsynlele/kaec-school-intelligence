"use client";

import { useEffect } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function KhposSyncBridge() {
  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabaseClient();
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session?.access_token) return;
      try {
        await fetch("/api/integrations/khpos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "sync" }),
          cache: "no-store",
        });
      } catch {
        // Integration sync is non-blocking. KSI remains fully usable if KHP-OS is unavailable.
      }
    });
    return () => { active = false; };
  }, []);

  return null;
}
