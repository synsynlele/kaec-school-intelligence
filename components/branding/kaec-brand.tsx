import { KsiBrand } from "@/components/branding/ksi-brand";

/** Compatibility wrapper for older entry points; KSI owns the product identity. */
export function KaecBrand({ compact = false }: { compact?: boolean }) {
  return <KsiBrand compact={compact} />;
}
