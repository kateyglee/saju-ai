// Capture env vars in main bundle (Next.js inlines NEXT_PUBLIC_* at build time)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let client: any = null;
let initPromise: Promise<any> | null = null;

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return { _lazy: true };
}

export async function getSupabase(): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (client) return client;
  if (!initPromise) {
    initPromise = import("@supabase/ssr").then(({ createBrowserClient }) => {
      client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
      return client;
    });
  }
  return initPromise;
}
