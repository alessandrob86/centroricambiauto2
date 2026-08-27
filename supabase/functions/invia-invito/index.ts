import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Manda per email il codice d'invito, dal mittente aziendale.
 *
 * Prima si copiava il codice a mano e si apriva il programma di posta. Va
 * bene per tre clienti, non per trecento: qui l'email parte dal sistema, con
 * lo stesso mittente verificato delle proposte d'ordine, e resta scritto
 * quando è partita.
 *
 * Chi può chiamarla:
 *   invito a un CLIENTE     -> admin e manager
 *   invito a un COLLEGA     -> solo admin, come tutto ciò che tocca il personale
 *
 * Segreti (gli stessi di invia-proposta-scheda, non ne servono di nuovi):
 *   RESEND_API_KEY_CRA   la chiave Resend del dominio centroricambiautosrl.it
 *   CRA_ORDER_FROM       mittente, facoltativo
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

const ROSSO = "#BD3432";
const ORO = "#FDC543";
const ANTRACITE = "#272D2B";

/* Il codice va letto e ribattuto: grande, spaziato, monospaziato. È la sola
   cosa che deve saltare all'occhio in tutta l'email. */
function corpoEmail(o: { saluto: string; intro: string; codice: string; dove: string; scade: string; coda: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${ANTRACITE};border-top:4px solid ${ROSSO};border-radius:10px 10px 0 0;padding:20px 24px">
      <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em">CENTRO RICAMBI AUTO</div>
      <div style="color:${ORO};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:4px">Il vostro accesso</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p style="margin:0 0 14px;color:#111827;font-size:16px">${o.saluto}</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">${o.intro}</p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid ${ROSSO};border-radius:8px;padding:18px 20px;text-align:center">
        <div style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Codice invito</div>
        <div style="font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:700;letter-spacing:.18em;color:${ANTRACITE}">${esc(o.codice)}</div>
      </div>

      <p style="margin:20px 0 6px;color:#374151;font-size:15px;line-height:1.6">
        Registratevi a questo indirizzo e inserite il codice nel primo campo del modulo:
      </p>
      <p style="margin:0 0 20px">
        <a href="${esc(o.dove)}" style="display:inline-block;background:${ROSSO};color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:6px">Vai alla registrazione</a>
      </p>
      <p style="margin:0 0 18px;color:#6b7280;font-size:13px;word-break:break-all">${esc(o.dove)}</p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;color:#6b7280;font-size:13px;line-height:1.5">
        Il codice vale <b>una volta sola</b> e scade il ${esc(o.scade)}. ${o.coda}
      </div>

      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">
        Centro Ricambi Auto srl — il vero specialista dei ricambi
      </p>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "solo POST" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: ute } = await admin.auth.getUser(jwt);
    if (!ute?.user) return json({ error: "accesso richiesto" }, 401);

    const { data: chiamante } = await admin.from("dipendenti")
      .select("id, ruolo, attivo").eq("user_id", ute.user.id).maybeSingle();
    const { data: off } = await admin.from("officine")
      .select("is_admin").eq("user_id", ute.user.id).maybeSingle();
    const isAdmin = chiamante?.ruolo === "admin" || off?.is_admin === true;
    const puoGestire = isAdmin || (chiamante?.attivo === true && chiamante?.ruolo === "manager");
    if (!puoGestire) return json({ error: "riservato a chi gestisce i clienti" }, 403);

    const b = await req.json().catch(() => ({}));
    const codice = String(b.codice ?? "").trim().toUpperCase();
    if (!codice) return json({ error: "codice mancante" }, 400);

    /* L'indirizzo del sito arriva da chi chiama, ma non ci si fida: deve
       essere uno dei nostri, altrimenti l'email porterebbe i clienti su un
       sito civetta con il nostro logo sopra. */
    const AMMESSI = [/\.netlify\.app$/i, /(^|\.)centroricambiautosrl\.it$/i, /(^|\.)l2f\.it$/i];
    let sito = "https://spontaneous-duckanoo-35348b.netlify.app";
    try {
      const u = new URL(String(b.sito ?? ""));
      if (u.protocol === "https:" && AMMESSI.some((r) => r.test(u.hostname))) sito = u.origin;
    } catch { /* si tiene quello di riserva */ }

    const { data: inv } = await admin.from("inviti")
      .select("codice, officina_id, dipendente_id, email, scade_il, usato_il, inviato_il")
      .eq("codice", codice).maybeSingle();
    if (!inv) return json({ error: "codice inesistente" }, 404);
    if (inv.usato_il) return json({ error: "questo codice è già stato usato" }, 400);
    if (new Date(inv.scade_il) <= new Date()) return json({ error: "questo codice è scaduto" }, 400);

    // Il personale lo invita solo l'amministratore.
    if (inv.dipendente_id && !isAdmin) {
      return json({ error: "solo un amministratore può invitare il personale" }, 403);
    }

    let a = inv.email as string | null;
    let saluto = "Buongiorno,";
    let intro = "";
    let coda = "";

    if (inv.dipendente_id) {
      const { data: d } = await admin.from("dipendenti")
        .select("nome, cognome, email").eq("id", inv.dipendente_id).maybeSingle();
      if (!d) return json({ error: "scheda dipendente inesistente" }, 404);
      a = a ?? d.email;
      saluto = `Ciao ${esc([d.nome, d.cognome].filter(Boolean).join(" ")) || "collega"},`;
      intro = "ti è stato attivato l'accesso all'area interna: bacheca, Card Center, i tuoi clienti e le proposte d'ordine.";
      coda = "Usa il tuo indirizzo aziendale: è quello a cui abbiamo mandato questo messaggio.";
    } else if (inv.officina_id) {
      const { data: o } = await admin.from("officine")
        .select("ragione_sociale, email").eq("id", inv.officina_id).maybeSingle();
      if (!o) return json({ error: "anagrafica inesistente" }, 404);
      a = a ?? o.email;
      saluto = `Buongiorno ${esc(o.ragione_sociale ?? "")},`.replace(" ,", ",");
      intro = "abbiamo attivato il vostro accesso riservato al CRA Store: catalogo completo, i vostri prezzi e le proposte d'ordine. Nessun pagamento online — confermiamo noi disponibilità e tempi.";
      coda = "Dopo la registrazione verificheremo i dati e attiveremo l'accesso.";
    } else {
      intro = "abbiamo attivato il vostro accesso riservato al CRA Store.";
      coda = "Dopo la registrazione verificheremo i dati e attiveremo l'accesso.";
    }

    if (!a) return json({ error: "non c'è un indirizzo email a cui mandarlo" }, 400);

    const RESEND = Deno.env.get("RESEND_API_KEY_CRA");
    if (!RESEND) return json({ error: "secret RESEND_API_KEY_CRA non configurato" }, 400);
    const FROM = Deno.env.get("CRA_ORDER_FROM") ?? "Centro Ricambi Auto <noreply@centroricambiautosrl.it>";

    const html = corpoEmail({
      saluto, intro, codice,
      dove: `${sito}/#/login`,
      scade: new Date(inv.scade_il).toLocaleDateString("it-IT"),
      coda,
    });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [a],
        subject: inv.dipendente_id
          ? "Il tuo accesso all'area interna"
          : "Il vostro accesso al CRA Store",
        html,
      }),
    });

    if (!r.ok) {
      const t = (await r.text()).slice(0, 300);
      return json({ error: "l'email non è partita", dettaglio: t }, 502);
    }

    await admin.from("inviti").update({ inviato_il: new Date().toISOString() }).eq("codice", codice);
    return json({ ok: true, a });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
