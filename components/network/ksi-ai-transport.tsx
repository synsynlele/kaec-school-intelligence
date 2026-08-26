"use client";

import { useEffect } from "react";

const DIRECT_AI_ORIGIN = "https://kaec-school-intelligence.vercel.app";
const CUSTOM_DOMAINS = new Set(["ksi.name.ng", "www.ksi.name.ng"]);
const LONG_AI_PATHS = new Set([
  "/api/diagnosis",
  "/api/assessment",
  "/api/hqls",
]);

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function KsiAiTransport() {
  useEffect(() => {
    if (!CUSTOM_DOMAINS.has(window.location.hostname.toLowerCase())) return;

    const originalFetch = window.fetch;
    const routedFetch: typeof window.fetch = (input, init) => {
      if (requestMethod(input, init) !== "POST") {
        return originalFetch.call(window, input, init);
      }

      // KSI's generation clients use string/URL inputs. Leave Request objects
      // untouched so we never risk consuming or cloning an existing body stream.
      if (typeof Request !== "undefined" && input instanceof Request) {
        return originalFetch.call(window, input, init);
      }

      const currentUrl = new URL(requestUrl(input), window.location.href);
      if (
        currentUrl.origin !== window.location.origin ||
        !LONG_AI_PATHS.has(currentUrl.pathname)
      ) {
        return originalFetch.call(window, input, init);
      }

      const directUrl = `${DIRECT_AI_ORIGIN}${currentUrl.pathname}${currentUrl.search}`;
      return originalFetch.call(window, directUrl, init);
    };

    window.fetch = routedFetch;
    return () => {
      if (window.fetch === routedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
