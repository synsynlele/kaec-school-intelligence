import { ImageResponse } from "next/og";
import { createElement } from "react";

const canonicalKsiIconUrl = "https://www.ksi.name.ng/icon.png";

export function renderPwaIcon(size: number) {
  return new ImageResponse(
    createElement("img", {
      src: canonicalKsiIconUrl,
      alt: "",
      width: size,
      height: size,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
      },
    }),
    { width: size, height: size },
  );
}
