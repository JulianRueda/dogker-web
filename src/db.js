// Cliente de solo lectura para la tienda pública: PostgREST directo (~25 KB) en vez de supabase-js completo (~230 KB).
// El panel /admin sigue usando src/supabase.js porque necesita Auth y Storage.
import { PostgrestClient } from "@supabase/postgrest-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const db = url && key ? new PostgrestClient(`${url}/rest/v1`, { headers: { apikey: key } }) : null;
