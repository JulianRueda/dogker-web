import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null si falta el .env: la tienda muestra su estado de error y el admin un aviso, en vez de romper la página.
export const supabase = url && key ? createClient(url, key) : null;
export const BUCKET = "productos";
