import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* La cassetta dei suggerimenti.
 *
 * Un pulsante sopra la campanella, una finestrella, invio. Arriva una mail
 * a una casella sola — quella di chi il sito lo decide — con dentro chi ha
 * scritto, da quale pagina, e con «rispondi» già puntato sul mittente.
 *
 * Due accorgimenti che valgono più del resto:
 *
 *   1. La riga si scrive nel database PRIMA di provare a mandare l'email.
 *      Se Resend è giù, il suggerimento non si perde: resta in `feedback`
 *      con scritto perché non è partito. Al contrario — email prima, riga
 *      dopo — un guasto del mittente cancellerebbe quello che uno ha
 *      appena finito di scrivere, ed è la volta che non lo riscrive.
 *
 *   2. Cinque messaggi all'ora a testa. Non è diffidenza verso i colleghi:
 *      è che un pulsante tenuto premuto per sbaglio, o una pagina che si
 *      riapre da sola, riempiono una casella in un minuto.
 *
 * Segreti: gli stessi delle altre — RESEND_API_KEY_CRA, CRA_ORDER_FROM.
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

/** A chi arrivano i suggerimenti. Volutamente scritto qui e non passato da
 *  chi chiama: un indirizzo che arriva dal browser è un indirizzo che
 *  chiunque può cambiare. */
const A = "alessandro@centroricambiautosrl.it";

const ROSSO = "#BD3432";
const ORO = "#FDC543";
const ANTRACITE = "#272D2B";

const RUOLI: Record<string, string> = {
  admin: "amministratore",
  manager: "manager",
  finanza: "finanza",
  rappresentante: "rappresentante",
  centralino: "centralino",
  dipendente: "in squadra",
};

function corpoEmail(o: { chi: string; ruolo: string; email: string; pagina: string; testo: string }) {
  /* Il testo arriva da una casella di scrittura: va messo in pagina come
     testo, non come HTML, o il primo che scrive «<b>» cambia l'email — e
     il secondo ci mette qualcosa di peggio. `esc` prima, gli a capo dopo. */
  const testo = esc(o.testo).replace(/\r?\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${ANTRACITE};border-top:4px solid ${ORO};border-radius:10px 10px 0 0;padding:20px 24px">
      <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em">CENTRO RICAMBI AUTO</div>
      <div style="color:${ORO};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:4px">Un suggerimento dal sito</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p style="margin:0 0 4px;color:#111827;font-size:16px"><b>${esc(o.chi)}</b></p>
      <p style="margin:0 0 18px;color:#6b7280;font-size:13px">
        ${esc(o.ruolo)}${o.email ? ` &middot; ${esc(o.email)}` : ""}
      </p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid ${ROSSO};border-radius:8px;padding:18px 20px;color:#111827;font-size:15px;line-height:1.65">
        ${testo}
      </div>

      <p style="margin:18px 0 0;color:#9ca3af;font-size:12px">
        Scritto da: ${esc(o.pagina || "—")}
      </p>
      <p style="margin:6px 0 0;color:#9ca3af;font-size:12px">
        Rispondendo a questa email rispondi direttamente a chi l'ha scritta.
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

    const b = await req.json().catch(() => ({}));
    const testo = String(b.testo ?? "").trim();
    if (testo.length < 4) return json({ error: "scrivi qualcosa in più" }, 400);
    if (testo.length > 4000) return json({ error: "il messaggio è troppo lungo" }, 400);
    const pagina = String(b.pagina ?? "").trim().slice(0, 300);

    // Cinque all'ora: oltre, è quasi sempre un dito rimasto premuto.
    const unOraFa = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ute.user.id).gte("created_at", unOraFa);
    if ((count ?? 0) >= 5) {
      return json({ error: "hai già mandato parecchi messaggi: riprova fra un'ora" }, 429);
    }

    const { data: d } = await admin.from("dipendenti")
      .select("id, nome, cognome, ruolo, attivo").eq("user_id", ute.user.id).maybeSingle();
    const { data: off } = await admin.from("officine")
      .select("ragione_sociale").eq("user_id", ute.user.id).maybeSingle();

    const chi = [d?.nome, d?.cognome].filter(Boolean).join(" ").trim()
      || off?.ragione_sociale
      || ute.user.email
      || "qualcuno";
    const ruolo = d?.attivo ? (RUOLI[d.ruolo] ?? d.ruolo) : (off ? "cliente" : "—");
    const email = ute.user.email ?? "";

    // Prima la riga, poi l'email: se il mittente cade, il testo resta.
    const { data: riga } = await admin.from("feedback").insert({
      user_id: ute.user.id,
      dipendente_id: d?.id ?? null,
      nome: chi, email, ruolo, testo, pagina,
    }).select("id").single();

    const RESEND = Deno.env.get("RESEND_API_KEY_CRA");
    if (!RESEND) {
      await admin.from("feedback").update({ errore: "RESEND_API_KEY_CRA non configurato" })
        .eq("id", riga?.id ?? "");
      return json({ ok: true, salvato: true, spedito: false });
    }
    const FROM = Deno.env.get("CRA_ORDER_FROM") ?? "Centro Ricambi Auto <noreply@centroricambiautosrl.it>";

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [A],
        reply_to: email || undefined,
        subject: `Suggerimento da ${chi}`,
        html: corpoEmail({ chi, ruolo, email, pagina, testo }),
      }),
    });

    if (!r.ok) {
      const t = (await r.text()).slice(0, 300);
      await admin.from("feedback").update({ errore: t }).eq("id", riga?.id ?? "");
      /* Non è un errore per chi ha scritto: il messaggio è al sicuro e
         verrà letto lo stesso. Dirgli «non è partito» lo farebbe
         riscrivere tre volte la stessa cosa. */
      return json({ ok: true, salvato: true, spedito: false });
    }

    await admin.from("feedback").update({ inviato_il: new Date().toISOString() })
      .eq("id", riga?.id ?? "");
    return json({ ok: true, salvato: true, spedito: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
