// Recuperato dal server il 26 agosto 2026 perché mancava dal repository.
// È il codice in produzione così com'è: può differire da come lo si scriverebbe oggi.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Porta a casa i media del vecchio portale.
 *
 * Le 138 locandine e i 6 allegati importati puntano ancora al deposito
 * pubblico di ProjectB: finché quel progetto è acceso si vedono, il giorno
 * che lo spegni spariscono. Questa funzione li scarica e li ricarica nel
 * deposito privato `cra-interno`, poi riscrive il percorso sulla scheda.
 *
 * Lavora a scaglioni: un file può pesare qualche megabyte e il tempo di una
 * chiamata non è infinito. Si richiama finché `rimasti` non arriva a zero.
 * È ripetibile senza danni — chi è già stato spostato non ha più l'indirizzo
 * vecchio, quindi non viene ripreso.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const VECCHIO = "https://kliqbpdqufsgniqspbrb.supabase.co/storage/v1/object/public/card-center/";
const BUCKET = "cra-interno";
const MAX_BYTE = 25_000_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { limite } = await req.json().catch(() => ({ limite: 15 }));
    const quanti = Math.min(Math.max(Number(limite) || 15, 1), 40);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "non autenticato" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Sposta i file solo chi comanda: è un'operazione che riscrive le schede.
    const { data: dip } = await admin
      .from("dipendenti").select("ruolo")
      .eq("user_id", user.id).eq("attivo", true).maybeSingle();
    const { data: off } = await admin
      .from("officine").select("is_admin").eq("user_id", user.id).maybeSingle();
    if (dip?.ruolo !== "admin" && off?.is_admin !== true) {
      return json({ error: "solo un amministratore può spostare i media" }, 403);
    }

    const { data: righe, error } = await admin
      .from("schede")
      .select("id, immagine, allegato")
      .or(`immagine.like.${VECCHIO}%,allegato.like.${VECCHIO}%`)
      .limit(quanti);
    if (error) return json({ error: error.message }, 500);

    const errori: Array<{ scheda: string; motivo: string }> = [];
    let fatti = 0, file = 0;

    for (const r of righe ?? []) {
      const patch: Record<string, string> = {};
      for (const campo of ["immagine", "allegato"] as const) {
        const via = r[campo] as string | null;
        if (!via || !via.startsWith(VECCHIO)) continue;
        try {
          const risposta = await fetch(via);
          if (!risposta.ok) throw new Error(`il vecchio deposito risponde ${risposta.status}`);
          const blob = await risposta.blob();
          if (blob.size === 0) throw new Error("file vuoto");
          if (blob.size > MAX_BYTE) throw new Error(`troppo grande (${Math.round(blob.size / 1e6)} MB)`);

          // Si conserva il nome originale: i file del vecchio portale hanno
          // già un prefisso temporale, quindi non collidono fra loro.
          const nome = decodeURIComponent(via.slice(VECCHIO.length)).split("/").pop()!;
          const dove = `${campo === "immagine" ? "immagini" : "allegati"}/migrati/${nome}`;

          const { error: su } = await admin.storage.from(BUCKET).upload(dove, blob, {
            contentType: blob.type || "application/octet-stream",
            upsert: true,
          });
          if (su) throw new Error(su.message);

          patch[campo] = dove;
          file++;
        } catch (e) {
          errori.push({ scheda: r.id, motivo: `${campo}: ${String((e as Error).message ?? e)}` });
        }
      }
      if (Object.keys(patch).length) {
        const { error: up } = await admin.from("schede").update(patch).eq("id", r.id);
        if (up) errori.push({ scheda: r.id, motivo: up.message });
        else fatti++;
      }
    }

    const { count } = await admin
      .from("schede")
      .select("id", { count: "exact", head: true })
      .or(`immagine.like.${VECCHIO}%,allegato.like.${VECCHIO}%`);

    return json({ ok: true, schede: fatti, file, rimasti: count ?? 0, errori });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
