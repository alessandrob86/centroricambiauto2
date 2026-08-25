import { createClient } from "@supabase/supabase-js";

/* Progetto Supabase CONDIVISO con il sito L2F: stessa auth, stessa
   anagrafica officine. I flag per-sito (cra_abilitata / l2f_abilitata)
   decidono cosa può fare l'account su ciascun negozio. */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  /* Fallire subito e forte: senza env il sito non può funzionare
     (su Netlify le VITE_ sono cablate al build). */
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
