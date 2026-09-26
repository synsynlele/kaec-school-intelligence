import Image from "next/image";

export function KsiBrand({ compact = false }: { compact?: boolean }) {
  const size = compact ? 42 : 54;

  return (
    <div className="flex items-center gap-3">
      <Image
        src="/ksi-mark.svg"
        alt="KSI product mark"
        width={size}
        height={size}
        unoptimized
        className="shrink-0"
      />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p
            className={`${compact ? "text-lg" : "text-xl"} font-black tracking-[-0.04em] text-[#0B3268]`}
          >
            KSI
          </p>
          {!compact ? (
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              by KAEC-NG
            </span>
          ) : null}
        </div>
        <p
          className={`${compact ? "text-[10px]" : "text-xs"} whitespace-nowrap font-semibold tracking-tight text-zinc-600`}
        >
          KAEC School Intelligence
        </p>
      </div>
    </div>
  );
}
