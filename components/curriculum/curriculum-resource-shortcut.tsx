"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function CurriculumResourceShortcut() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase: SupabaseClient = getBrowserSupabaseClient();
    void supabase.rpc("get_scheme_review_access").then(({ data }) => {
      if (!cancelled) setAllowed(data === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
      <Link
        href="/curriculum/resources"
        className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-950"
      >
        Open Curriculum Resource Factory →
      </Link>
    </div>
  );
}