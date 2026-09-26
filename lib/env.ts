// Central place for env vars. NEXT_PUBLIC_* are safe in the browser, everything else is server-only.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

/** Server-only settings for the weekly email. Read when needed, so the app runs without them until then. */
export const serverEnv = {
  gmailUser: () => required("GMAIL_USER", process.env.GMAIL_USER),
  gmailAppPassword: () => required("GMAIL_APP_PASSWORD", process.env.GMAIL_APP_PASSWORD),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  cronSecret: () => required("CRON_SECRET", process.env.CRON_SECRET),
};
