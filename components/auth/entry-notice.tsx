"use client";

import { useEffect, useState } from "react";

export function EntryNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const notice = new URLSearchParams(window.location.search).get("notice");
    if (notice === "student-surface-retired") {
      setMessage(
        "Student-facing KSI has been retired. Learner records remain securely available to authorised teachers and school leadership for diagnosis, intervention and learning support.",
      );
    }
  }, []);

  if (!message) return null;
  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      {message}
    </div>
  );
}
