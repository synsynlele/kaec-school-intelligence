"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  queryKey: "lesson" | "assessment";
  resultPath: "/hqls/result" | "/assessment/result";
};

export function ArtifactResultRedirect({ queryKey, resultPath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSession = useRef(searchParams.get("edit") === "1");
  const artifactId = searchParams.get(queryKey)?.trim() ?? "";

  useEffect(() => {
    if (!artifactId || editSession.current) return;
    router.replace(`${resultPath}?${queryKey}=${encodeURIComponent(artifactId)}`);
  }, [artifactId, queryKey, resultPath, router]);

  return null;
}
