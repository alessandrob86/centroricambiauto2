import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Proposta d'ordine da una scheda del Card Center.
 *
 * È il gesto del rappresentante: apre una scheda di tipo `promozione`,
 * sceglie il cliente, scrive quantità e note, e la proposta arriva a
 * ordini@centroricambiautosrl.it — la stessa casella e lo stesso stile
 * delle proposte del CRA Store.
 *
 * Perché una funzione a parte e non `send-order-cra`: là il mittente è il
 * cliente stesso e la funzione verifica che l'officina sia la sua. Qui il
 * mittente è un DIPENDENTE che ordina PER un cliente: il controllo è un
 * altro, e mescolarli avrebbe indebolito entrambi.
 *
 * Segreti: RESEND_API_KEY_CRA (account Resend del dominio CRA) e,
 * facoltativo, CRA_ORDER_FROM.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const RED = "#bd3432";
const GOLD = "#fdc543";
const CHARCOAL = "#272d2b";
const NOTIFY_TO = "ordini@centroricambiautosrl.it";
const BUCKET = "cra-interno";
/* Oltre questa soglia la foto non si allega: una mail che non arriva è
   peggio di una mail senza immagine. 6 MB grezzi ≈ 8 MB in base64. */
const MAX_FOTO = 6_000_000;

/* Chi può proporre a qualunque cliente, anche senza averlo in portafoglio.
   È la regola di `scheda_dest_read`, e va ripetuta qui perché esito e ordine
   li scriviamo con la chiave di servizio, che della RLS non sa nulla.
   Il centralino c'è perché risponde per tutti, non perché abbia clienti suoi:
   è anche l'unico ruolo che di suo non potrebbe scrivere su `scheda_esiti` e
   `scheda_ordini`, dove la RLS ammette solo admin e manager. */
const RUOLI_SENZA_PORTAFOGLIO = ["admin", "manager", "finanza", "centralino"];

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

/* btoa vuole una stringa: si converte a blocchi, perché passare un array
   di milioni di byte a String.fromCharCode fa esplodere lo stack. */
function base64(bytes: Uint8Array): string {
  let s = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    s += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(s);
}

const TIPI_IMG: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", avif: "image/avif",
};

function craEmail(o: { pre: string; heading: string; sub?: string; body: string; logo?: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${o.pre}</div>
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:${CHARCOAL};border-top:4px solid ${RED};border-radius:10px 10px 0 0;padding:20px 24px">
      ${o.logo ?? `<div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em">CENTRO RICAMBI AUTO</div>`}
      <div style="color:${GOLD};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:4px">${o.sub ?? "Rete commerciale"}</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:22px 24px">
      <h1 style="margin:0 0 14px;color:#111827;font-size:20px">${o.heading}</h1>
      ${o.body}
      <p style="margin:22px 0 0;color:#9ca3af;font-size:12px">Centro Ricambi Auto srl — il vero specialista dei ricambi · ordini@centroricambiautosrl.it</p>
    </div>
  </div></body></html>`;
}

const riga = (etichetta: string, valore: string) =>
  `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;white-space:nowrap">${esc(etichetta)}</td>` +
  `<td style="padding:6px 0 6px 16px;color:#111827;font-size:14px;font-weight:600">${esc(valore)}</td></tr>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { scheda_id, officina_id, quantita, note, documento } = await req.json();
    if (!scheda_id || !officina_id) return json({ error: "scheda_id e officina_id sono obbligatori" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "non autenticato" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Deve essere personale CRA attivo: il controllo sta qui, non nel browser.
    const { data: dip } = await admin
      .from("dipendenti")
      .select("id, nome, cognome, email, ruolo, zone(nome)")
      .eq("user_id", user.id).eq("attivo", true).maybeSingle();
    if (!dip) return json({ error: "solo il personale CRA può inviare proposte" }, 403);

    const { data: scheda } = await admin
      .from("schede")
      .select("id, titolo, tipo, immagine, prezzo_unitario, costo_unitario, tipi_scheda(nome, inoltrabile)")
      .eq("id", scheda_id).maybeSingle();
    if (!scheda) return json({ error: "scheda non trovata" }, 404);
    // La regola che conta: solo i tipi inoltrabili si mandano.
    if (!(scheda as any).tipi_scheda?.inoltrabile) {
      return json({ error: "questo tipo di scheda non si può inoltrare come proposta" }, 400);
    }

    const { data: off } = await admin
      .from("officine")
      .select("id, ragione_sociale, codice_cliente, piva, citta, provincia, telefono, email, documento_predefinito, agente_id")
      .eq("id", officina_id).maybeSingle();
    if (!off) return json({ error: "cliente non trovato" }, 404);

    /* Essere personale attivo non basta: il cliente dev'essere il proprio.
       Senza questo un rappresentante si intesta proposte "accettate" sui
       clienti dei colleghi — le sue statistiche salgono e le loro si sporcano. */
    if (!RUOLI_SENZA_PORTAFOGLIO.includes(dip.ruolo) && (off as any).agente_id !== dip.id) {
      return json({ error: "questo cliente non è in carico a te" }, 403);
    }

    const RESEND = Deno.env.get("RESEND_API_KEY_CRA");
    const FROM = Deno.env.get("CRA_ORDER_FROM") ?? "Centro Ricambi Auto <noreply@centroricambiautosrl.it>";
    if (!RESEND) return json({ ok: true, emailed: false, motivo: "RESEND_API_KEY_CRA non configurata" });

    const agente = `${dip.nome ?? ""} ${dip.cognome ?? ""}`.trim() || dip.email || "—";
    const filiale = (dip as any).zone?.nome ?? "—";
    const q = Number(quantita) > 0 ? Number(quantita) : 1;

    /* Il documento che accompagna la merce. Se l'agente non ne sceglie uno
       vale il predefinito del cliente — che è quello giusto quasi sempre, e
       che nessuno deve ricordarsi a memoria. Si verifica contro la tabella e
       non contro un elenco scritto qui: se domani se ne aggiunge uno, questa
       funzione non va toccata. Un codice inventato viene rifiutato. */
    const codiceDoc = documento || (off as any).documento_predefinito || null;
    let doc: { codice: string; nome: string } | null = null;
    if (codiceDoc) {
      const { data } = await admin.from("tipi_documento")
        .select("codice, nome").eq("codice", codiceDoc).eq("attivo", true).maybeSingle();
      if (!data) return json({ error: `documento non riconosciuto: ${codiceDoc}` }, 400);
      doc = data;
    }

    /* La locandina della promozione viaggia DENTRO la mail, allegata e
       mostrata in linea. Il bucket è privato: un link firmato scadrebbe e
       lascerebbe in archivio una mail con un buco al posto dell'offerta. */
    const attachments: Array<Record<string, string>> = [];

    /* Il marchio: vive in app_config, non nel codice. Così si cambia senza
       ridistribuire la funzione, e non viaggia come link esterno che i
       programmi di posta bloccano di default. */
    let logo = "";
    const { data: cfg } = await admin
      .from("app_config").select("value").eq("key", "email_logo_gif_b64").maybeSingle();
    if (cfg?.value) {
      attachments.push({
        filename: "centro-ricambi-auto.gif", content: cfg.value,
        content_type: "image/gif", content_id: "logocra",
      });
      logo = `<img src="cid:logocra" alt="Centro Ricambi Auto" width="220" ` +
        `style="display:block;width:220px;max-width:100%;height:auto;border:0" />`;
    }

    let locandina = "";
    if (scheda.immagine) {
      const via = String(scheda.immagine);
      // Le schede migrate dal vecchio portale puntano a un indirizzo intero;
      // quelle nate qui a un percorso nel deposito privato.
      const file = via.startsWith("http")
        ? await fetch(via).then((r) => (r.ok ? r.blob() : null)).catch(() => null)
        : (await admin.storage.from(BUCKET).download(via)).data;
      if (file && file.size > 0 && file.size <= MAX_FOTO) {
        const nome = via.split("?")[0].split("/").pop() || "promozione.jpg";
        const est = nome.split(".").pop()?.toLowerCase() ?? "";
        const bytes = new Uint8Array(await file.arrayBuffer());
        attachments.push({
          filename: nome,
          content: base64(bytes),
          content_type: file.type || TIPI_IMG[est] || "image/jpeg",
          content_id: "locandina",
        });
        locandina =
          `<img src="cid:locandina" alt="${esc(scheda.titolo)}" width="552" ` +
          `style="display:block;width:100%;max-width:552px;height:auto;margin:0 0 18px;border:1px solid #e5e7eb" />`;
      }
    }

    const body =
      `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px">` +
      riga("Cliente", off.ragione_sociale) +
      (off.codice_cliente ? riga("Codice cliente", off.codice_cliente) : "") +
      (off.piva ? riga("Partita IVA", off.piva) : "") +
      (off.citta ? riga("Località", `${off.citta}${off.provincia ? ` (${off.provincia})` : ""}`) : "") +
      (off.telefono ? riga("Telefono", off.telefono) : "") +
      (off.email ? riga("Email cliente", off.email) : "") +
      `</table>` +
      locandina +
      `<div style="background:#faf0ef;border-left:3px solid ${RED};padding:12px 16px;margin-bottom:18px">` +
      `<div style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Proposta</div>` +
      `<div style="color:#111827;font-size:16px;font-weight:700">${esc(scheda.titolo)}</div>` +
      `<div style="color:#111827;font-size:14px;margin-top:6px">Quantità richiesta: <b>${q}</b></div>` +
      `</div>` +
      /* Il documento sta in un riquadro suo, col codice in grande: è la cosa
         che in magazzino determina cosa si stampa, e una riga in mezzo alle
         altre si legge solo quando si è già sbagliato. */
      (doc
        ? `<div style="border:2px solid ${CHARCOAL};margin:0 0 18px">` +
          `<div style="background:${CHARCOAL};color:${GOLD};font-size:12px;font-weight:700;` +
          `text-transform:uppercase;letter-spacing:.12em;padding:9px 16px">Documento da emettere</div>` +
          `<div style="padding:14px 16px">` +
          `<div style="color:#111827;font-size:28px;font-weight:800;letter-spacing:.03em;line-height:1">${esc(doc.codice)}</div>` +
          `<div style="color:#374151;font-size:14px;margin-top:5px">${esc(doc.nome)}</div>` +
          `</div></div>`
        : "") +
      (note ? `<p style="margin:0 0 18px;color:#374151;font-size:14px"><b>Note:</b> ${esc(note)}</p>` : "") +
      `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
      riga("Inviata da", agente) + riga("Filiale", filiale) + `</table>`;

    const html = craEmail({
      pre: `Proposta ${off.ragione_sociale} — ${scheda.titolo}`,
      heading: "Nuova proposta d'ordine",
      sub: "Rete commerciale",
      body, logo,
    });

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [NOTIFY_TO],
        reply_to: dip.email ? [dip.email] : undefined,
        subject: `Proposta ${doc ? `${doc.codice} ` : ""}— ${off.ragione_sociale}` +
          `${off.codice_cliente ? ` (${off.codice_cliente})` : ""} · ${scheda.titolo}`,
        html,
        attachments: attachments.length ? attachments : undefined,
      }),
    });

    /* L'invio vale accettazione, e non è una scorciatoia: l'agente è col
       cliente quando preme invia, e questa mail parte su ordini@ perché il
       cliente ha già detto sì. Il rifiuto è l'unica cosa che si dichiara a
       mano, perché è l'unica che non lascia traccia da sola.
       Si registra anche se la mail non parte: il lavoro su quel cliente è
       stato fatto e il conteggio non deve perderlo.
       `inviata_il` è un'altra cosa dall'esito: dice QUANDO è partita. */
    await admin.from("scheda_esiti").upsert({
      scheda_id, officina_id, esito: "accettata", quantita: q,
      note: note ?? null, aggiornato_da: dip.id, documento: doc?.codice ?? null,
      inviata_il: new Date().toISOString(), aggiornato_il: new Date().toISOString(),
    }, { onConflict: "scheda_id,officina_id" });

    /* Il registro delle proposte: una riga per ogni invio, anche ripetuto
       sullo stesso cliente. `scheda_esiti` dice com'è andata, questo dice
       quante volte e quando — ed è da qui che nascono le statistiche. */
    await admin.from("scheda_ordini").insert({
      scheda_id, officina_id, dipendente_id: dip.id, quantita: q,
      prezzo_unitario: (scheda as any).prezzo_unitario ?? null,
      costo_unitario: (scheda as any).costo_unitario ?? null,
      esito: "accettata", note: note ?? null, origine: "portale",
      documento: doc?.codice ?? null,
    });

    return json({ ok: true, emailed: resp.ok, foto: attachments.length > 1 });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
