const FALLBACK_SUPABASE_URL = 'https://myrtdfyjoxvtubusrrmf.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_128ongB0ItsEwmef_F1zTg_YnxFX6M8';

/**
 * Supabase publishable configuration is safe for browser use and is still
 * protected by database RLS. Environment variables remain authoritative;
 * these values keep preview server functions working until Vercel Git/env
 * integration is configured natively.
 */
export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
  };
}
