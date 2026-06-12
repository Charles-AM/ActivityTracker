import { createClient } from "@supabase/supabase-js";
import type { Submission } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient<{
      public: {
        Tables: {
          submissions: {
            Row: Submission;
            Insert: Omit<Submission, "id" | "created_at"> & {
              id?: string;
              created_at?: string;
            };
            Update: Partial<Omit<Submission, "id" | "created_at">>;
          };
        };
      };
    }>(supabaseUrl, supabaseAnonKey)
  : null;

export const proofBucket = "challenge-proofs";
