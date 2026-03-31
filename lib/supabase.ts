let client: any = null;
let initPromise: Promise<any> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { _lazy: true, url, key };
}

export async function getSupabase(): Promise<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (client) return client;
  if (!initPromise) {
    initPromise = import("@supabase/ssr").then(({ createBrowserClient }) => {
      client = createBrowserClient(url, key);
      return client;
    });
  }
  return initPromise;
}
