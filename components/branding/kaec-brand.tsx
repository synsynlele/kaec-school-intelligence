import Image from "next/image";

import { KAEC_OFFICIAL_LOGO_DATA_URI } from "@/lib/branding/official-kaec-logo";

export function KaecBrand({ compact = false }: { compact?: boolean }) {
  const size = compact ? 42 : 54;

  return (
    <div className="flex items-center gap-3">
      <Image
        src={KAEC_OFFICIAL_LOGO_DATA_URI}
        alt="KAEC-NG official logo"
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full"
      />
      <div>
        <p
          className={`${compact ? "text-sm" : "text-base"} font-semibold tracking-tight text-zinc-950`}
        >
          KAEC-NG
        </p>
        <p
          className={`${compact ? "text-[11px]" : "text-xs"} text-zinc-500`}
        >
          School Intelligence
        </p>
      </div>
    </div>
  );
}
