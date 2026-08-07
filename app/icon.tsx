import { ImageResponse } from "next/og";

import { KAEC_OFFICIAL_LOGO_DATA_URI } from "@/lib/branding/official-kaec-logo";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "white",
        borderRadius: "50%",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={KAEC_OFFICIAL_LOGO_DATA_URI} alt="" width="64" height="64" />
    </div>,
    size,
  );
}
