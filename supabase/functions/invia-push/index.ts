import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cifra, chiavePrivata, gettoneVapid } from "./cifratura.ts";

/* Notifiche push verso i dispositivi iscritti.
 *
 * La cifratura sta in `cifratura.ts` (RFC 8291 + 8292), provata a parte.
 *
 * Segreti richiesti:
 *   VAPID_PRIVATA   scalare a 32 byte in base64url (43 caratteri)
 *   VAPID_SUBJECT   un mailto: o un https:// di contatto
 * La chiave pubblica sta in app_config.vapid_pubblica, così ruotarla non
 * obbliga a ricompilare il sito.
 *
 * POST, solo personale. Corpo:
 *   { titolo, corpo, url?, prova?, zone?[], ruoli?[], utenti?[] }
 *   `prova: true` manda solo a chi chiama — serve al pulsante di verifica.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function manda(
  iscr: { endpoint: string; p256dh: string; auth: string },
  payload: string, priv: CryptoKey, pubblica: string, sub: string,
) {
  const corpo = await cifra(payload, iscr.p256dh, iscr.auth);
  const t = await gettoneVapid(iscr.endpoint, priv, sub);
  const r = await fetch(iscr.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
      "Authorization": "vapid t=" + t + ", k=" + pubblica,
    },
    body: corpo,
  });
  return { stato: r.status, testo: r.ok ? "" : (await r.text()).slice(0, 200) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "solo POST" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const b = await req.json().catch(() => ({}));

    /* Verifica della configurazione. Non chiede un accesso perché non rivela
       niente: solo dei sì/no sulla forma della chiave. Il valore del segreto
       non esce da qui, e la chiave pubblica è pubblica per definizione.
       Serve a distinguere «segreto assente» da «segreto sbagliato», che
       altrimenti si vedrebbero uguali: nessuna notifica e nessun errore. */
    if (b.verifica) {
      const p = Deno.env.get("VAPID_PRIVATA") ?? "";
      const { data: c } = await admin.from("app_config")
        .select("value").eq("key", "vapid_pubblica").maybeSingle();

      const esito: Record<string, unknown> = {
        privata_presente: p.length > 0,
        privata_lunghezza: p.length,          // 43 se è uno scalare da 32 byte
        pubblica_in_config: !!c?.value,
        subject: !!Deno.env.get("VAPID_SUBJECT"),
        coppia_valida: false,
      };

      // La prova vera: firmare e riverificare con la pubblica. Se la privata
      // fosse di un'altra coppia — o un segnaposto incollato per sbaglio —
      // qui si vede subito.
      if (p && c?.value) {
        try {
          const priv = await chiavePrivata(p, c.value);
          const msg = new TextEncoder().encode("prova");
          const firma = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, msg);
          const punto = Uint8Array.from(
            atob(c.value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((c.value.length + 3) % 4)),
            (ch) => ch.charCodeAt(0));
          const pub = await crypto.subtle.importKey("raw", punto,
            { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
          esito.coppia_valida = await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" }, pub, firma, msg);
        } catch (e) {
          esito.errore = String((e as Error)?.message ?? e);
        }
      }

      esito.pronto = esito.privata_presente && esito.pubblica_in_config && esito.coppia_valida;
      return json(esito);
    }

    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: ute } = await admin.auth.getUser(jwt);
    if (!ute?.user) return json({ error: "accesso richiesto" }, 401);

    const { data: dip } = await admin.from("dipendenti")
      .select("id, ruolo, zona_id, attivo").eq("user_id", ute.user.id).maybeSingle();
    if (!dip?.attivo) return json({ error: "riservato al personale" }, 403);

    const titolo = String(b.titolo ?? "").trim();
    const corpoMsg = String(b.corpo ?? "").trim();
    if (!titolo) return json({ error: "manca il titolo" }, 400);

    const privB64 = Deno.env.get("VAPID_PRIVATA");
    const sub = Deno.env.get("VAPID_SUBJECT") ?? "mailto:alessandro@centroricambiautosrl.it";
    if (!privB64) return json({ error: "secret VAPID_PRIVATA non configurato" }, 400);

    const { data: cfg } = await admin.from("app_config")
      .select("value").eq("key", "vapid_pubblica").maybeSingle();
    if (!cfg?.value) return json({ error: "chiave pubblica VAPID assente da app_config" }, 400);

    // Chi riceve. Una prova va solo a chi la chiede: mandare a tutti per
    // sbaglio non si annulla.
    let q = admin.from("push_iscrizioni")
      .select("id, endpoint, p256dh, auth, user_id").eq("attiva", true);

    if (b.prova) {
      q = q.eq("user_id", ute.user.id);
    } else if (Array.isArray(b.utenti) && b.utenti.length) {
      q = q.in("user_id", b.utenti);
    } else if ((Array.isArray(b.zone) && b.zone.length) || (Array.isArray(b.ruoli) && b.ruoli.length)) {
      let dq = admin.from("dipendenti").select("user_id").eq("attivo", true).not("user_id", "is", null);
      if (Array.isArray(b.zone) && b.zone.length) dq = dq.in("zona_id", b.zone);
      if (Array.isArray(b.ruoli) && b.ruoli.length) dq = dq.in("ruolo", b.ruoli);
      const { data: chi } = await dq;
      const ids = (chi ?? []).map((r: { user_id: string }) => r.user_id);
      if (!ids.length) return json({ inviate: 0, fallite: 0, nota: "nessun destinatario per quei filtri" });
      q = q.in("user_id", ids);
    } else if (dip.ruolo !== "admin" && dip.ruolo !== "manager") {
      return json({ error: "solo admin e manager possono mandare a tutti" }, 403);
    }

    const { data: iscrizioni, error } = await q;
    if (error) throw error;
    if (!iscrizioni?.length) return json({ inviate: 0, fallite: 0, nota: "nessun dispositivo iscritto" });

    const priv = await chiavePrivata(privB64, cfg.value);
    const payload = JSON.stringify({
      titolo, corpo: corpoMsg,
      url: typeof b.url === "string" ? b.url : "/#/interno",
    });

    let inviate = 0;
    const fallite: string[] = [];
    const scadute: string[] = [];
    const riuscite: string[] = [];

    for (const i of iscrizioni) {
      try {
        const r = await manda(i, payload, priv, cfg.value, sub);
        if (r.stato >= 200 && r.stato < 300) { inviate++; riuscite.push(i.id); }
        // 404/410: quel dispositivo non esiste più. Si toglie, sennò si
        // riproverebbe a ogni invio per sempre.
        else if (r.stato === 404 || r.stato === 410) scadute.push(i.id);
        else fallite.push(r.stato + " " + r.testo);
      } catch (e) {
        fallite.push(String((e as Error)?.message ?? e));
      }
    }

    if (scadute.length) await admin.from("push_iscrizioni").delete().in("id", scadute);
    if (riuscite.length) {
      await admin.from("push_iscrizioni")
        .update({ ultimo_uso: new Date().toISOString() }).in("id", riuscite);
    }

    return json({
      inviate, fallite: fallite.length, scadute: scadute.length,
      dettagli: fallite.slice(0, 3),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
