"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function CurriculumReviewShortcut() {
  const [canReview, setCanReview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabaseClient();

    void supabase
      .rpc("get_scheme_review_access")
      .then(({ data, error }) => {
        if (!cancelled && !error && data === true) setCanReview(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!canReview) return null;

  return (
    <Link
      href="/curriculum/review"
      className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-lg shadow-zinc-950/5 transition hover:border-amber-400 hover:bg-amber-100"
    >
      Curriculum Review
    </Link>
  );
}
