import { ImageResponse } from "next/og";
import { createElement } from "react";

export function renderPwaIcon(size: number) {
  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #052e2b 0%, #064e3b 52%, #047857 100%)",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        },
      },
      createElement(
        "div",
        {
          style: {
            width: "72%",
            height: "72%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "27%",
            border: `${Math.max(3, Math.round(size * 0.018))}px solid rgba(255,255,255,0.3)`,
            background: "rgba(255,255,255,0.09)",
            boxShadow: "0 24px 80px rgba(2,44,34,0.34)",
            fontSize: `${Math.round(size * 0.24)}px`,
            fontWeight: 800,
            letterSpacing: "-0.06em",
          },
        },
        "KSI",
      ),
    ),
    { width: size, height: size },
  );
}
