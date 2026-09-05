import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* «Questo cliente lo seguono in due.»
 *
 * Non è un errore da bloccare: capita che una stessa officina la lavorino
 * in due, e chi decide se va bene è una persona sola. Quindi il sistema non
 * impedisce niente — registra, e lo dice.
 *
 * Chi chiama non decide NIENTE del contenuto: passa solo l'identificativo
 * del cliente, e la funzione va a leggersi da sola chi lo segue davvero.
 * Se glielo si lasciasse raccontare, questo diventerebbe un modo per far
 * partire email a piacere dalla casella aziendale.
 *
 * Si manda una volta sola per condivisione: `officina_agenti.avvisato_il`
 * tiene il conto. Riaprire la pagina o ripremere il pulsante non rimanda
 * niente.
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

/** A chi arrivano gli avvisi. Scritto qui, non passato da chi chiama. */
const A = "alessandro@centroricambiautosrl.it";

const ROSSO = "#BD3432";
const ORO = "#FDC543";
const ANTRACITE = "#272D2B";

const giorno = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function corpoEmail(o: {
  cliente: string; codice: string; dove: string;
  agenti: Array<{ nome: string; ruolo: string; filiale: string; dal: string | null; nuovo: boolean }>;
}) {
  const righe = o.agenti.map((a) => `
    <tr>
      <td style="padding:8px 0;border-top:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:${a.nuovo ? 700 : 400}">
        ${esc(a.nome)}${a.nuovo ? ` <span style="color:${ROSSO};font-size:12px;font-weight:700">&nbsp;appena aggiunto</span>` : ""}
      </td>
      <td style="padding:8px 0 8px 16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px">${esc(a.ruolo)}${a.filiale ? ` · ${esc(a.filiale)}` : ""}</td>
      <td style="padding:8px 0 8px 16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;white-space:nowrap">dal ${esc(giorno(a.dal))}</td>
    </tr>`).join("");

  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:${ANTRACITE};border-top:4px solid ${ORO};border-radius:10px 10px 0 0;padding:20px 24px">
      <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em">CENTRO RICAMBI AUTO</div>
      <div style="color:${ORO};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:4px">Un cliente seguito in più</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p style="margin:0 0 4px;color:#111827;font-size:18px;font-weight:700">${esc(o.cliente)}</p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px">
        ${o.codice ? `${esc(o.codice)} · ` : ""}${esc(o.dove)}
      </p>

      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
        ${righe}
      </table>

      <p style="margin:22px 0 0;color:#374151;font-size:14px;line-height:1.6">
        Non è stato bloccato niente: tutti e ${o.agenti.length} vedono il cliente e possono
        mandargli proposte. Se non va bene, si toglie da <b>Area interna → I miei clienti</b>.
      </p>
      <p style="margin:18px 0 0;color:#9ca3af;font-size:12px">
        Questo avviso parte una volta sola per ogni persona che si aggiunge.
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
      .select("id, attivo").eq("user_id", ute.user.id).maybeSingle();
    if (!chiamante?.attivo) return json({ error: "riservato al personale" }, 403);

    const b = await req.json().catch(() => ({}));
    const officinaId = String(b.officina_id ?? "").trim();
    if (!officinaId) return json({ error: "officina_id mancante" }, 400);

    /* La verità si legge qui, non la si riceve. */
    const { data: righe } = await admin.from("officina_agenti")
      .select("dipendente_id, preso_il, avvisato_il, dipendenti(nome, cognome, ruolo, zone(nome))")
      .eq("officina_id", officinaId)
      .order("preso_il");

    if (!righe || righe.length < 2) {
      return json({ ok: true, avvisato: false, motivo: "questo cliente non è seguito in più" });
    }
    const daAvvisare = righe.filter((r) => !r.avvisato_il);
    if (daAvvisare.length === 0) {
      return json({ ok: true, avvisato: false, motivo: "già avvisato" });
    }

    const { data: off } = await admin.from("officine")
      .select("ragione_sociale, codice_cliente, citta, provincia").eq("id", officinaId).maybeSingle();
    if (!off) return json({ error: "cliente inesistente" }, 404);

    const nuovi = new Set(daAvvisare.map((r) => r.dipendente_id));
    const agenti = righe.map((r) => {
      const d = (r as { dipendenti?: { nome?: string; cognome?: string; ruolo?: string; zone?: { nome?: string } } }).dipendenti;
      return {
        nome: [d?.nome, d?.cognome].filter(Boolean).join(" ").trim() || "—",
        ruolo: d?.ruolo ?? "—",
        filiale: d?.zone?.nome ?? "",
        dal: r.preso_il as string,
        nuovo: nuovi.has(r.dipendente_id),
      };
    });

    const RESEND = Deno.env.get("RESEND_API_KEY_CRA");
    const FROM = Deno.env.get("CRA_ORDER_FROM") ?? "Centro Ricambi Auto <noreply@centroricambiautosrl.it>";
    if (!RESEND) return json({ ok: true, avvisato: false, motivo: "RESEND_API_KEY_CRA non configurato" });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [A],
        subject: `${off.ragione_sociale} è seguito da ${agenti.length} persone`,
        html: corpoEmail({
          cliente: off.ragione_sociale ?? "—",
          codice: off.codice_cliente ?? "",
          dove: [off.citta, off.provincia && `(${off.provincia})`].filter(Boolean).join(" "),
          agenti,
        }),
      }),
    });

    if (!r.ok) {
      const t = (await r.text()).slice(0, 300);
      /* Non si segna come avvisato: al prossimo tentativo ci riprova. La
         notifica dentro il sito è già partita comunque, scritta dal
         database nel momento stesso in cui il cliente è stato preso. */
      return json({ ok: true, avvisato: false, motivo: "l'email non è partita", dettaglio: t });
    }

    await admin.from("officina_agenti")
      .update({ avvisato_il: new Date().toISOString() })
      .eq("officina_id", officinaId).is("avvisato_il", null);

    return json({ ok: true, avvisato: true, quanti: agenti.length });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
