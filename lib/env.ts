export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

const KSI_SUPABASE_URL = "https://zaoxfjbiizargeclnzmo.supabase.co";
const KSI_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_grqUBVOShJOM3i9jMF9ucg_gI4xr-58";

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? KSI_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    KSI_SUPABASE_PUBLISHABLE_KEY;

  return { url, publishableKey };
}

export function hasSupabasePublicEnv(): boolean {
  const { url, publishableKey } = getSupabasePublicEnv();
  return Boolean(url && publishableKey);
}
