import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const normalizeSupabaseUrl = (value: string | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return null;
  }
};

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

export const supabaseConfigError =
  rawSupabaseUrl && !supabaseUrl
    ? "VITE_SUPABASE_URL should look like https://your-project-id.supabase.co"
    : "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export const proofBucket = "challenge-proofs";
