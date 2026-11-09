const SUPABASE_URL = "https://ehpcetfzckmxyxqmowvp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wWiK0NGMVARtpqMErFN6Hg_TwpDWe-y";

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);