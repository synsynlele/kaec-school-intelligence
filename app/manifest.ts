import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/ksi",
    name: "KAEC School Intelligence",
    short_name: "KSI",
    description:
      "Teacher and leadership intelligence for better learning decisions, evidence and next steps.",
    start_url: "/sign-in",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#064e3b",
    orientation: "any",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Open KSI",
        short_name: "Open KSI",
        url: "/sign-in",
      },
      {
        name: "HQLS Lessons",
        short_name: "HQLS",
        url: "/hqls",
      },
      {
        name: "Assessments",
        short_name: "Assessments",
        url: "/assessment",
      },
      {
        name: "Diagnosis",
        short_name: "Diagnosis",
        url: "/diagnosis",
      },
    ],
  };
}
